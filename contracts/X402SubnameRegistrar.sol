// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);

    function ownerOf(uint256 id) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IENSRegistry {
    function owner(bytes32 node) external view returns (address);
}

/**
 * @title X402SubnameRegistrar
 * @notice Mints permanent ENS subnames under 402bot.eth, 402api.eth, 402mcp.eth
 * @dev Requires NameWrapper approval before minting. Owner can add/remove parent nodes.
 */
contract X402SubnameRegistrar is Ownable, ReentrancyGuard {

    // ── Constants ────────────────────────────────────────────────────────────
    INameWrapper  public immutable nameWrapper;
    IENSRegistry  public immutable ensRegistry;
    address       public immutable publicResolver;

    uint256 public mintFee = 0.005 ether;

    // ── State ─────────────────────────────────────────────────────────────────
    /// @notice Supported parent nodes (namehash of 402bot.eth, etc.)
    mapping(bytes32 => bool) public supportedParents;
    bytes32[] public parentList;

    // ── Events ────────────────────────────────────────────────────────────────
    event SubnameMinted(
        bytes32 indexed parentNode,
        string  label,
        bytes32 subnameNode,
        address indexed minter,
        uint256 fee
    );
    event ParentAdded(bytes32 indexed node, string label);
    event ParentRemoved(bytes32 indexed node);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeWithdrawn(address indexed to, uint256 amount);

    // ── Constructor ───────────────────────────────────────────────────────────
    constructor(
        address _nameWrapper,
        address _ensRegistry,
        address _publicResolver
    ) Ownable(msg.sender) {
        nameWrapper   = INameWrapper(_nameWrapper);
        ensRegistry   = IENSRegistry(_ensRegistry);
        publicResolver = _publicResolver;
    }

    // ── Admin Functions ───────────────────────────────────────────────────────

    /**
     * @notice Add a parent ENS node (e.g. namehash("402bot.eth"))
     * @dev Must approve this contract as operator on NameWrapper first
     */
    function addParent(bytes32 node, string calldata label) external onlyOwner {
        require(!supportedParents[node], "Already supported");
        supportedParents[node] = true;
        parentList.push(node);
        emit ParentAdded(node, label);
    }

    function removeParent(bytes32 node) external onlyOwner {
        require(supportedParents[node], "Not supported");
        supportedParents[node] = false;
        emit ParentRemoved(node);
    }

    function setMintFee(uint256 newFee) external onlyOwner {
        emit FeeUpdated(mintFee, newFee);
        mintFee = newFee;
    }

    function withdrawFees() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");
        (bool ok, ) = owner().call{value: bal}("");
        require(ok, "Transfer failed");
        emit FeeWithdrawn(owner(), bal);
    }

    // ── Core: Register ────────────────────────────────────────────────────────

    /**
     * @notice Mint a subname under a supported parent
     * @param parentNode  namehash of parent (402bot.eth, 402api.eth, 402mcp.eth)
     * @param label       The subdomain label (e.g. "myagent")
     */
    function register(
        bytes32 parentNode,
        string calldata label
    ) external payable nonReentrant {
        // Validations
        require(supportedParents[parentNode], "Unsupported parent");
        require(msg.value >= mintFee, "Insufficient fee");
        require(bytes(label).length >= 3, "Label too short (min 3 chars)");
        require(_isValidLabel(label), "Invalid label characters");

        // Check availability: ownerOf returns 0 if unregistered
        bytes32 subnameNode = _makeNode(parentNode, label);
        uint256 tokenId = uint256(subnameNode);
        try nameWrapper.ownerOf(tokenId) returns (address existing) {
            require(existing == address(0), "Label already taken");
        } catch {
            // ownerOf reverts for non-existent tokens — name is available
        }

        // Check registrar is approved operator on NameWrapper
        // Use nameWrapper.ownerOf() — ensRegistry.owner() returns the NameWrapper
        // contract address for wrapped names, not the actual holder.
        address parentOwner = nameWrapper.ownerOf(uint256(parentNode));
        require(
            nameWrapper.isApprovedForAll(parentOwner, address(this)),
            "Registrar not approved as operator"
        );

        // Mint: permanent subname, full control for minter, no fuses burned
        bytes32 node = nameWrapper.setSubnodeRecord(
            parentNode,
            label,
            msg.sender,
            publicResolver,
            0,                    // TTL
            0,                    // fuses = PARENT_CANNOT_CONTROL not set → revocable by parent
            type(uint64).max      // max expiry = permanent
        );

        // Refund excess ETH
        uint256 excess = msg.value - mintFee;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        emit SubnameMinted(parentNode, label, node, msg.sender, mintFee);
    }

    /**
     * @notice Batch mint multiple subnames in one tx (sequential calls)
     */
    function batchRegister(
        bytes32[] calldata parentNodes,
        string[]  calldata labels
    ) external payable nonReentrant {
        require(parentNodes.length == labels.length, "Length mismatch");
        require(parentNodes.length > 0, "Empty batch");
        require(msg.value >= mintFee * parentNodes.length, "Insufficient fee for batch");

        uint256 totalRefund = msg.value - (mintFee * parentNodes.length);

        for (uint256 i = 0; i < parentNodes.length; i++) {
            bytes32 parentNode = parentNodes[i];
            string calldata label = labels[i];

            require(supportedParents[parentNode], "Unsupported parent");
            require(bytes(label).length >= 3, "Label too short");
            require(_isValidLabel(label), "Invalid label");

            bytes32 subnameNode = _makeNode(parentNode, label);
            uint256 tokenId = uint256(subnameNode);
            try nameWrapper.ownerOf(tokenId) returns (address existing) {
                require(existing == address(0), "Label already taken");
            } catch { }

            address parentOwner = nameWrapper.ownerOf(uint256(parentNode));
            require(
                nameWrapper.isApprovedForAll(parentOwner, address(this)),
                "Registrar not approved as operator"
            );

            bytes32 node = nameWrapper.setSubnodeRecord(
                parentNode,
                label,
                msg.sender,
                publicResolver,
                0,
                0,
                type(uint64).max
            );

            emit SubnameMinted(parentNode, label, node, msg.sender, mintFee);
        }

        // Refund excess
        if (totalRefund > 0) {
            (bool ok, ) = msg.sender.call{value: totalRefund}("");
            require(ok, "Refund failed");
        }
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function isAvailable(bytes32 parentNode, string calldata label)
        external
        view
        returns (bool available)
    {
        bytes32 subnameNode = _makeNode(parentNode, label);
        uint256 tokenId = uint256(subnameNode);
        try nameWrapper.ownerOf(tokenId) returns (address existing) {
            return existing == address(0);
        } catch {
            return true;
        }
    }

    function getParentList() external view returns (bytes32[] memory) {
        return parentList;
    }

    // ── Internal Helpers ──────────────────────────────────────────────────────

    function _makeNode(bytes32 parentNode, string calldata label)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }

    /// @dev Only allow lowercase a-z, 0-9, and hyphens (not at start/end)
    function _isValidLabel(string calldata label) internal pure returns (bool) {
        bytes memory b = bytes(label);
        if (b[0] == 0x2D || b[b.length - 1] == 0x2D) return false; // no leading/trailing hyphen
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool isLower = (c >= 0x61 && c <= 0x7A);
            bool isDigit = (c >= 0x30 && c <= 0x39);
            bool isHyphen = (c == 0x2D);
            if (!isLower && !isDigit && !isHyphen) return false;
        }
        return true;
    }

    receive() external payable {}
}
