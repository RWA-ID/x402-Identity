// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/// @dev Minimal NameWrapper mock — supports the registrar's calls.
contract MockNameWrapper is ERC1155 {
    mapping(address => mapping(address => bool)) private _ops;
    mapping(uint256 => address) private _owners;

    constructor() ERC1155("") {}

    function mintParent(address to, uint256 tokenId) external {
        _mint(to, tokenId, 1, "");
        _owners[tokenId] = to;
    }

    function ownerOf(uint256 id) external view returns (address) {
        address o = _owners[id];
        require(o != address(0), "no token");
        return o;
    }

    function isApprovedForAll(address owner, address operator)
        public
        view
        override
        returns (bool)
    {
        return _ops[owner][operator];
    }

    function setApprovalForAll(address operator, bool approved) public override {
        _ops[msg.sender][operator] = approved;
    }

    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address /*resolver*/,
        uint64  /*ttl*/,
        uint32  /*fuses*/,
        uint64  /*expiry*/
    ) external returns (bytes32 node) {
        node = keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
        uint256 id = uint256(node);
        require(_owners[id] == address(0), "exists");
        _owners[id] = owner;
        _mint(owner, id, 1, "");
    }

    // Track owner on transfer so ownerOf stays in sync.
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        super._update(from, to, ids, values);
        for (uint256 i = 0; i < ids.length; i++) {
            if (values[i] > 0 && to != address(0)) {
                _owners[ids[i]] = to;
            }
        }
    }
}
