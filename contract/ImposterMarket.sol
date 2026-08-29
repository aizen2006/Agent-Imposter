// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ImposterMarket — Parimutuel prediction market for Agent Imposter on Monad
/// @notice Bet MON on which of 6 agents is the hidden Imposter. Winners split the pool.
/// @dev The imposter is committed at createGame and verified at resolve, so the outcome
///      is provably fixed before any stake is placed. If the resolver never returns,
///      `abandon` opens the game for refunds without anyone's permission.
contract ImposterMarket {
    uint8 public constant AGENT_COUNT = 6;

    /// @notice Sentinel for "no imposter revealed yet". Never a valid agent index,
    ///         so a caller reading `games(id)` before resolution cannot mistake the
    ///         default for an accusation of agent 0.
    uint8 public constant NO_AGENT = type(uint8).max;

    /// @notice How long after betting closes the resolver has to resolve before
    ///         anyone may open the game for refunds.
    uint64 public constant RESOLVE_WINDOW = 24 hours;

    struct Game {
        uint64 closeAt; // betting closes at this unix timestamp
        bool exists;
        bool resolved;
        bool abandoned; // resolved via timeout — everyone is refunded their stake
        uint8 imposterId; // NO_AGENT until resolved
        bytes32 commitment; // keccak256(abi.encodePacked(gameId, imposterId, salt))
        uint256 totalPool;
    }

    address public resolver;

    mapping(uint256 => Game) public games;
    mapping(uint256 => uint256[AGENT_COUNT]) private _agentPool;
    mapping(uint256 => mapping(address => uint256[AGENT_COUNT])) private _stake;
    mapping(uint256 => mapping(address => uint256)) private _staked;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event GameCreated(uint256 indexed gameId, uint64 closeAt, bytes32 commitment);
    event BetPlaced(uint256 indexed gameId, address indexed user, uint8 agentId, uint256 amount);
    event GameResolved(uint256 indexed gameId, uint8 imposterId);
    event GameAbandoned(uint256 indexed gameId);
    event Claimed(uint256 indexed gameId, address indexed user, uint256 amount);
    event ResolverChanged(address indexed from, address indexed to);

    modifier onlyResolver() {
        require(msg.sender == resolver, "not resolver");
        _;
    }

    /// @param _resolver Backend wallet authorized to create and resolve games (0x0 defaults to deployer)
    constructor(address _resolver) {
        resolver = _resolver == address(0) ? msg.sender : _resolver;
        emit ResolverChanged(address(0), resolver);
    }

    function setResolver(address r) external onlyResolver {
        require(r != address(0), "zero address");
        emit ResolverChanged(resolver, r);
        resolver = r;
    }

    /// @notice Initialize a match.
    /// @param commitment keccak256(abi.encodePacked(gameId, imposterId, salt)) — required.
    ///        The salt must be 32 bytes of CSPRNG output. With only six possible imposter
    ///        values, a guessable salt makes the commitment a six-try brute force.
    function createGame(uint256 gameId, uint64 closeAt, bytes32 commitment) external onlyResolver {
        require(!games[gameId].exists, "game exists");
        require(closeAt > block.timestamp, "closeAt in past");
        require(commitment != bytes32(0), "commitment required");
        games[gameId] = Game({
            closeAt: closeAt,
            exists: true,
            resolved: false,
            abandoned: false,
            imposterId: NO_AGENT,
            commitment: commitment,
            totalPool: 0
        });
        emit GameCreated(gameId, closeAt, commitment);
    }

    /// @notice Stake native MON on an agent index (0..5)
    /// @dev The resolver knows the answer from the moment the game is simulated, so it
    ///      is barred from its own market.
    function bet(uint256 gameId, uint8 agentId) external payable {
        require(msg.sender != resolver, "resolver cannot bet");

        Game storage g = games[gameId];
        require(g.exists, "no game");
        require(!g.resolved, "resolved");
        require(block.timestamp < g.closeAt, "betting closed");
        require(agentId < AGENT_COUNT, "bad agent");
        require(msg.value > 0, "zero stake");

        _agentPool[gameId][agentId] += msg.value;
        _stake[gameId][msg.sender][agentId] += msg.value;
        _staked[gameId][msg.sender] += msg.value;
        g.totalPool += msg.value;

        emit BetPlaced(gameId, msg.sender, agentId, msg.value);
    }

    /// @notice Reveal the imposter. Also closes betting early (crew wins before the last round).
    /// @dev The commitment is verified unconditionally — there is no bypass.
    function resolve(uint256 gameId, uint8 imposterId, bytes32 salt) external onlyResolver {
        Game storage g = games[gameId];
        require(g.exists, "no game");
        require(!g.resolved, "already resolved");
        require(imposterId < AGENT_COUNT, "bad agent");
        require(
            keccak256(abi.encodePacked(gameId, imposterId, salt)) == g.commitment,
            "commitment mismatch"
        );

        g.resolved = true;
        g.imposterId = imposterId;
        emit GameResolved(gameId, imposterId);
    }

    /// @notice Permissionless escape hatch. If the resolver never came back within
    ///         RESOLVE_WINDOW of the market closing, anyone may open the game so every
    ///         bettor can withdraw their original stake.
    function abandon(uint256 gameId) external {
        Game storage g = games[gameId];
        require(g.exists, "no game");
        require(!g.resolved, "already resolved");
        require(block.timestamp > g.closeAt + RESOLVE_WINDOW, "too early");

        g.resolved = true;
        g.abandoned = true;
        emit GameAbandoned(gameId);
    }

    /// @notice Pro-rata payout. Full refund if the game was abandoned, or if nobody
    ///         backed the imposter.
    function payoutOf(uint256 gameId, address user) public view returns (uint256) {
        Game storage g = games[gameId];
        if (!g.resolved || claimed[gameId][user]) return 0;

        // Must precede any use of imposterId: an abandoned game never set one, and
        // _agentPool[gameId][NO_AGENT] would revert on a 6-element array.
        if (g.abandoned) return _staked[gameId][user];

        uint256 winPool = _agentPool[gameId][g.imposterId];
        if (winPool == 0) return _staked[gameId][user];

        return (g.totalPool * _stake[gameId][user][g.imposterId]) / winPool;
    }

    /// @notice Withdraw winnings or refunds
    function claim(uint256 gameId) external {
        require(games[gameId].resolved, "unresolved");
        require(!claimed[gameId][msg.sender], "already claimed");

        uint256 payout = payoutOf(gameId, msg.sender);
        require(payout > 0, "nothing to claim");

        claimed[gameId][msg.sender] = true; // effects before interaction

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");

        emit Claimed(gameId, msg.sender, payout);
    }

    /// @notice Compute the commitment for a game off-chain-identically.
    /// @dev Pure and public — the hash is computable by anyone regardless. Exists so the
    ///      backend can assert its viem `encodePacked` matches this exactly before it
    ///      ships a game, rather than discovering a mismatch at resolve time.
    function commitmentFor(uint256 gameId, uint8 imposterId, bytes32 salt)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(gameId, imposterId, salt));
    }

    function pools(uint256 gameId) external view returns (uint256[AGENT_COUNT] memory) {
        return _agentPool[gameId];
    }

    function stakesOf(uint256 gameId, address user)
        external
        view
        returns (uint256[AGENT_COUNT] memory)
    {
        return _stake[gameId][user];
    }
}
