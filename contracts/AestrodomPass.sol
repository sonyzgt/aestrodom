// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721, ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Aestrodom Pass: 500 free-mint NFTs, one per wallet, mintable from `mintStart` onwards. Every pass shares the same artwork and
 * metadata. Holding a pass unlocks one sponsored (free) token launch per pass per day on
 * aestrodom.org; that quota is tracked off-chain by the platform, not by this contract.
 */
contract AestrodomPass is ERC721Enumerable, Ownable {
    uint256 public constant MAX_SUPPLY = 500;

    string private _metadataURI;
    bool public mintOpen;
    /// Unix time minting opens by itself. Before it every mint reverts, so nobody can mint early.
    uint256 public mintStart;
    mapping(address => bool) public hasMinted;

    error MintClosed();
    error MintNotStarted(uint256 opensAt);
    error SoldOut();
    error AlreadyMinted();

    event MintOpenChanged(bool open);
    event MetadataURIChanged(string uri);
    event MintStartChanged(uint256 opensAt);

    constructor(string memory metadataURI_, address owner_, uint256 mintStart_) ERC721("Aestrodom Pass", "APASS") Ownable(owner_) {
        _metadataURI = metadataURI_;
        mintOpen = true;
        mintStart = mintStart_;
    }

    /// Free mint, one per wallet, until 500 passes exist.
    function mint() external returns (uint256 tokenId) {
        if (!mintOpen) revert MintClosed();
        if (block.timestamp < mintStart) revert MintNotStarted(mintStart);
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        tokenId = totalSupply() + 1;
        if (tokenId > MAX_SUPPLY) revert SoldOut();
        hasMinted[msg.sender] = true;
        _safeMint(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _metadataURI;
    }

    function contractURI() external view returns (string memory) {
        return _metadataURI;
    }

    function setMintOpen(bool open) external onlyOwner {
        mintOpen = open;
        emit MintOpenChanged(open);
    }

    function setMintStart(uint256 opensAt) external onlyOwner {
        mintStart = opensAt;
        emit MintStartChanged(opensAt);
    }

    function setMetadataURI(string calldata uri) external onlyOwner {
        _metadataURI = uri;
        emit MetadataURIChanged(uri);
    }
}
