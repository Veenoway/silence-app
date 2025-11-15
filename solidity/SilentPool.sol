// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SilentPool is SepoliaConfig, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MERKLE_TREE_HEIGHT = 20;
    uint256 public constant MIN_WITHDRAWAL_DELAY = 0.1 hours;

    struct Pool {
        uint128 denomination;
        bool isActive;
        uint256 depositCount;
    }

    struct CommitmentMetadata {
        euint64 encryptedTimestamp;
        uint128 amount;
        bool exists;
    }

    struct WithdrawalRequest {
        bytes32 commitment;
        bytes32 nullifier;
        address recipient;
        address token;
        uint256 poolId;
        uint256 requestTimestamp;
        bool fulfilled;
    }

    mapping(address => mapping(uint256 => Pool)) public pools;
    mapping(address => uint256) public tokenPoolCount;
    mapping(address => mapping(uint256 => bytes32)) public merkleRoots;
    mapping(address => mapping(uint256 => uint256)) public nextLeafIndex;
    mapping(address => mapping(uint256 => mapping(uint256 => bytes32))) public commitmentLeaves;
    mapping(bytes32 => CommitmentMetadata) public commitmentMetadata;
    mapping(bytes32 => bool) public nullifierUsed;
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    uint256 public nextRequestId;

    event PoolCreated(address indexed token, uint256 poolId, uint128 denomination);
    event Deposit(address indexed token, uint256 indexed poolId, bytes32 indexed commitment, uint256 leafIndex);
    event WithdrawalRequested(uint256 indexed requestId, bytes32 indexed nullifier, address indexed recipient);
    event WithdrawalFulfilled(uint256 indexed requestId, address indexed recipient, uint128 amount);

    function createPool(address token, uint128 denomination) external returns (uint256) {
        require(denomination > 0, "Denomination must be > 0");

        uint256 poolId = tokenPoolCount[token];

        pools[token][poolId] = Pool({denomination: denomination, isActive: true, depositCount: 0});

        tokenPoolCount[token]++;

        emit PoolCreated(token, poolId, denomination);
        return poolId;
    }

    function togglePool(address token, uint256 poolId) external {
        pools[token][poolId].isActive = !pools[token][poolId].isActive;
    }

    function deposit(address token, uint256 poolId, bytes32 commitment) external payable nonReentrant {
        Pool storage pool = pools[token][poolId];

        require(pool.isActive, "Pool not active");
        require(!commitmentMetadata[commitment].exists, "Commitment already exists");

        if (token == address(0)) {
            // ETH
            require(msg.value == pool.denomination, "Wrong ETH amount");
        } else {
            // ERC20
            IERC20(token).safeTransferFrom(msg.sender, address(this), pool.denomination);
        }

        euint64 encTimestamp = FHE.asEuint64(uint64(block.timestamp));
        FHE.allowThis(encTimestamp);

        commitmentMetadata[commitment] = CommitmentMetadata({
            encryptedTimestamp: encTimestamp,
            amount: pool.denomination,
            exists: true
        });

        uint256 leafIndex = nextLeafIndex[token][poolId];
        commitmentLeaves[token][poolId][leafIndex] = commitment;
        nextLeafIndex[token][poolId]++;
        pool.depositCount++;

        merkleRoots[token][poolId] = keccak256(abi.encodePacked(merkleRoots[token][poolId], commitment));

        emit Deposit(token, poolId, commitment, leafIndex);
    }

    function requestWithdrawal(
        address token,
        uint256 poolId,
        bytes32 commitment,
        bytes32 nullifier,
        bytes32 secret,
        address recipient,
        bytes32[] calldata merkleProof
    ) external nonReentrant returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(pools[token][poolId].isActive, "Pool not active");
        require(!nullifierUsed[nullifier], "Nullifier already used");

        CommitmentMetadata storage meta = commitmentMetadata[commitment];
        require(meta.exists, "Commitment doesn't exist");

        bytes32 computedCommitment = keccak256(abi.encodePacked(nullifier, secret));
        require(computedCommitment == commitment, "Invalid proof: wrong secret");

        require(verifyMerkleProof(token, poolId, commitment, merkleProof), "Invalid merkle proof");

        uint256 requestId = nextRequestId++;

        withdrawalRequests[requestId] = WithdrawalRequest({
            commitment: commitment,
            nullifier: nullifier,
            recipient: recipient,
            token: token,
            poolId: poolId,
            requestTimestamp: block.timestamp,
            fulfilled: false
        });

        emit WithdrawalRequested(requestId, nullifier, recipient);

        return requestId;
    }

    function fulfillWithdrawal(uint256 requestId) external nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        require(request.requestTimestamp > 0, "Request not found");
        require(!request.fulfilled, "Already fulfilled");

        require(block.timestamp >= request.requestTimestamp + MIN_WITHDRAWAL_DELAY, "Wait 1 hour minimum for privacy");

        CommitmentMetadata storage meta = commitmentMetadata[request.commitment];
        uint128 amount = meta.amount;

        request.fulfilled = true;
        nullifierUsed[request.nullifier] = true;

        if (request.token == address(0)) {
            // ETH
            payable(request.recipient).transfer(amount);
        } else {
            // ERC20
            IERC20(request.token).safeTransfer(request.recipient, amount);
        }

        emit WithdrawalFulfilled(requestId, request.recipient, amount);
    }

    function verifyMerkleProof(
        address token,
        uint256 poolId,
        bytes32 commitment,
        bytes32[] calldata proof
    ) public view returns (bool) {
        uint256 maxIndex = nextLeafIndex[token][poolId];

        for (uint256 i = 0; i < maxIndex; i++) {
            if (commitmentLeaves[token][poolId][i] == commitment) {
                return true;
            }
        }

        return false;
    }

    function getPoolInfo(
        address token,
        uint256 poolId
    ) external view returns (bool isActive, uint128 denomination, uint256 depositCount, uint256 anonymitySetSize) {
        Pool storage pool = pools[token][poolId];
        return (pool.isActive, pool.denomination, pool.depositCount, nextLeafIndex[token][poolId]);
    }

    function getWithdrawalRequest(
        uint256 requestId
    )
        external
        view
        returns (
            bytes32 commitment,
            address recipient,
            uint256 requestTimestamp,
            bool fulfilled,
            uint256 timeUntilWithdrawal
        )
    {
        WithdrawalRequest storage req = withdrawalRequests[requestId];

        uint256 timeLeft = 0;
        if (!req.fulfilled && req.requestTimestamp > 0) {
            uint256 targetTime = req.requestTimestamp + MIN_WITHDRAWAL_DELAY;
            if (block.timestamp < targetTime) {
                timeLeft = targetTime - block.timestamp;
            }
        }

        return (req.commitment, req.recipient, req.requestTimestamp, req.fulfilled, timeLeft);
    }

    function commitmentExists(bytes32 commitment) external view returns (bool) {
        return commitmentMetadata[commitment].exists;
    }

    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifierUsed[nullifier];
    }

    function getMerkleRoot(address token, uint256 poolId) external view returns (bytes32) {
        return merkleRoots[token][poolId];
    }

    receive() external payable {}
}
