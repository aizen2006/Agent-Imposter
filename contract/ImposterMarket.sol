// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ImposterMarket — Parimutuel prediction market for Agent Imposter on Monad
/// @notice Bet MON on which of 6 agents is the hidden Imposter. Winners split the pool.
contract ImposterMarket {
    uint8 public constant AGENT_COUNT = 6;

    struct Game {
        uint64 closeAt; // betting closes at this unix timestamp
        bool exists;
        bool resolved;
        uint8 imposterId;
        bytes32 commitment; // keccak256(abi.encodePacked(imposterId, salt))
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
    event Claimed(uint256 indexed gameId, address indexed user, uint256 amount);

    modifier onlyResolver() {
        require(msg.sender == resolver, "not resolver");
        _;
    }

    /// @param _resolver Backend wallet address authorized to create and resolve games (0x0 defaults to deployer)
    constructor(address _resolver) {
        resolver = _resolver == address(0) ? msg.sender : _resolver;
    }

    function setResolver(address r) external onlyResolver {
        require(r != address(0), "zero address");
        resolver = r;
    }

    /// @notice Initialize a match with commitment hash: keccak256(abi.encodePacked(imposterId, salt))
    function createGame(uint256 gameId, uint64 closeAt, bytes32 commitment) external onlyResolver {
        require(!games[gameId].exists, "game exists");
        require(closeAt > block.timestamp, "closeAt in past");
        games[gameId] = Game({
            closeAt: closeAt,
            exists: true,
            resolved: false,
            imposterId: 0,
            commitment: commitment,
            totalPool: 0
        });
        emit GameCreated(gameId, closeAt, commitment);
    }

    /// @notice Stake native MON on an agent index (0..5)
    function bet(uint256 gameId, uint8 agentId) external payable {
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

    /// @notice Resolves the game and verifies the revealed imposter against the initial commitment
    function resolve(uint256 gameId, uint8 imposterId, bytes32 salt) external onlyResolver {
        Game storage g = games[gameId];
        require(g.exists, "no game");
        require(!g.resolved, "already resolved");
        require(imposterId < AGENT_COUNT, "bad agent");

        if (g.commitment != bytes32(0)) {
            require(
                keccak256(abi.encodePacked(imposterId, salt)) == g.commitment,
                "commitment mismatch"
            );
        }

        g.resolved = true;
        g.imposterId = imposterId;
        emit GameResolved(gameId, imposterId);
    }

    /// @notice Pro-rata payout calculation. Returns full refund if zero winning bets were placed.
    function payoutOf(uint256 gameId, address user) public view returns (uint256) {
        Game storage g = games[gameId];
        if (!g.resolved || claimed[gameId][user]) return 0;
        
        uint256 winPool = _agentPool[gameId][g.imposterId];
        if (winPool == 0) {
            return _staked[gameId][user];
        }
        return (g.totalPool * _stake[gameId][user][g.imposterId]) / winPool;
    }

    /// @notice Withdraw winnings or refunds
    function claim(uint256 gameId) external {
        require(games[gameId].resolved, "unresolved");
        require(!claimed[gameId][msg.sender], "already claimed");

        uint256 payout = payoutOf(gameId, msg.sender);
        require(payout > 0, "nothing to claim");

        claimed[gameId][msg.sender] = true;

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");

        emit Claimed(gameId, msg.sender, payout);
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