// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IBMCToken} from "./interfaces/IBMCToken.sol";
import {StandardArt} from "./StandardArt.sol";

/// @title BMC Illuminati Pass
/// @notice 500-piece ERC-721 collection minted by permanently burning BMC through `burnFrom`.
///
///  Phase 1 (token ids 1-40): sequential Genesis mints at 1,000,000 BMC each. Token #1 is the
///  Legendary Genesis. Token id N receives artwork genesis-NN.png for N in 1..40.
///
///  Phase 2 (token ids 41-500): commit-reveal draws without replacement from 37 additional Genesis
///  artworks (41-77) and 423 Standard artworks, at 350,000 BMC each. The mint burns and records the
///  mint block; the outcome is settled later, in mint order, from the hash of the block AFTER the
///  mint block, so it is unknown when the burn becomes irreversible. Anyone may call `reveal`.
///
///  WARNING: block-derived randomness is NOT cryptographically manipulation-resistant. The
///  proposer of the reveal block can bias one hash (and may withhold a block at a cost). Block
///  builders/validators can influence inclusion and ordering. Inventory uniqueness does not imply
///  fair allocation. This is the requested block-random design, not Chainlink VRF or the
///  deterministic development branch. See docs/SECURITY-REVIEW.md before authorizing public minting.
///
///  Reveal window: the reveal hash is read natively for 256 blocks and through the EIP-2935 history
///  contract for 8,191 blocks (about 27 hours). If nobody reveals a token within that window its
///  outcome settles as a Standard pass (Genesis only when no Standard remains), so delaying a reveal
///  can never improve an outcome.
///
///  Launch gate: on Ethereum Mainnet (chain id 1, including forks of it) both mint functions revert
///  until the owner calls `openMinting()` once; it can never be closed again. Other chain ids are
///  local rehearsal chains and are open from construction.
///
///  All mint parameters and metadata are fixed at construction. Ownership confers no special mint,
///  withdrawal, pause, price, metadata, randomness or upgrade power beyond that one-way opening.
contract BMCIlluminatiPass is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ------------------------------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------------------------------

    enum Tier {
        Pending, // 0: mystery token minted, outcome not yet revealed
        LegendaryGenesis, // 1: token #1
        Genesis, // 2
        Standard // 3
    }

    enum RevealStatus {
        None, // not minted
        AwaitingRandomness, // mystery token whose reveal block has not been finalized yet
        RandomnessStored, // reveal block finalized: `reveal` can settle it (in mint order)
        Revealed // tier and artwork assigned
    }

    // ------------------------------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------------------------------

    uint256 public constant MAX_SUPPLY = 500;
    uint256 public constant GENESIS_PHASE_SUPPLY = 40;
    uint256 public constant MYSTERY_SUPPLY = 460;
    uint256 public constant TOTAL_GENESIS = 77;
    uint256 public constant MYSTERY_GENESIS = 37;
    uint256 public constant TOTAL_STANDARD = 423;

    /// @dev BMC has 18 decimals (verified on mainnet; also re-checked on every mint).
    uint8 public constant BMC_DECIMALS = 18;
    uint256 public constant GENESIS_PRICE = 1_000_000 * 1e18;
    uint256 public constant MYSTERY_PRICE = 350_000 * 1e18;
    /// @dev 40 * 1,000,000 + 460 * 350,000 = 201,000,000 BMC.
    uint256 public constant MAX_TOTAL_BURN = 201_000_000 * 1e18;

    /// @notice Immutable IPFS directory supplied by the requester; genesis-01.png .. genesis-77.png.
    string public constant genesisImagesCID = "bafybeihfihwwpev4gkqjuqawgtptsv3ynzsokclo6odsolvoa65aqaac2u";

    /// @notice EIP-2935 block-hash history contract (Ethereum Mainnet since the Prague upgrade).
    address public constant BLOCK_HISTORY = 0x0000F90827F1C53a10cb7A02335B175320002935;
    /// @notice Blocks after the reveal block during which its hash is still readable on-chain.
    uint256 public constant REVEAL_WINDOW = 8191;
    /// @dev Chain on which the launch gate applies. Forks of mainnet keep this chain id.
    uint256 private constant LAUNCH_CHAIN_ID = 1;

    IBMCToken public immutable BMC;

    // ------------------------------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------------------------------

    /// @notice Number of NFTs minted so far (also the last token id).
    uint256 public totalMinted;
    /// @notice Total BMC (18-decimal units) burned through this contract.
    uint256 public totalBurned;
    /// @notice Number of mystery tokens whose outcome has been finalized.
    uint256 public revealedCount;
    /// @notice Number of Genesis outcomes drawn from the mystery pool so far.
    uint256 public mysteryGenesisRevealed;
    /// @notice True once minting has been opened. One-way; see `openMinting`.
    bool public mintingOpen;

    mapping(uint256 tokenId => Tier) private _tier;
    mapping(uint256 tokenId => uint16) private _artworkId;
    /// @dev Block in which a mystery token was minted; its outcome comes from the next block's hash.
    mapping(uint256 tokenId => uint256) private _mintBlock;

    /// @dev Virtual Fisher-Yates over 460 slots. slot(i) = i unless swapped; stores value + 1.
    mapping(uint256 => uint256) private _slotSwap;

    // ------------------------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------------------------

    event MintingOpened();
    event GenesisMinted(address indexed minter, uint256 indexed tokenId, uint16 artworkId, uint256 bmcBurned);
    event MysteryMinted(address indexed minter, uint256 indexed tokenId, uint256 bmcBurned, uint256 revealBlock);
    /// @param forced True when the reveal window expired and the outcome was settled as Standard.
    event Revealed(uint256 indexed tokenId, Tier tier, uint16 artworkId, bool forced);

    // ------------------------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------------------------

    error MintingNotOpen();
    error MintingAlreadyOpen();
    error BMCTokenUnavailable();
    error GenesisPhaseOver();
    error GenesisPhaseNotOver();
    error SoldOut();
    error UnexpectedTokenDecimals(uint8 actual);
    error BurnMismatch(uint256 expected, uint256 actual);
    error NonexistentToken(uint256 tokenId);

    // ------------------------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------------------------

    /// @param initialOwner Explicit owner, never the deploying factory. No mint/config privileges.
    /// @param bmcToken BMC on mainnet: 0x38224239f2BDae357D47cb864BC533d7f72dF961.
    /// @dev No external calls or code checks here: the factory rehearses on an empty chain.
    constructor(address initialOwner, address bmcToken) ERC721("BMC Illuminati Pass", "BMCPASS") Ownable(initialOwner) {
        require(bmcToken != address(0), "zero address");
        BMC = IBMCToken(bmcToken);
        // Launch gate only on the launch chain; rehearsal chains mint from construction.
        mintingOpen = block.chainid != LAUNCH_CHAIN_ID;
    }

    // ------------------------------------------------------------------------------------------
    // Launch gate
    // ------------------------------------------------------------------------------------------

    /// @notice One-way: opens public minting after deployment, verification and authorization.
    ///         There is no function that closes, pauses or otherwise restricts minting afterwards.
    function openMinting() external onlyOwner {
        if (mintingOpen) revert MintingAlreadyOpen();
        mintingOpen = true;
        emit MintingOpened();
    }

    // ------------------------------------------------------------------------------------------
    // Minting
    // ------------------------------------------------------------------------------------------

    /// @notice Phase 1: mint the next sequential Genesis NFT (ids 1-40) for 1,000,000 BMC.
    function mintGenesis() external nonReentrant returns (uint256 tokenId) {
        if (!mintingOpen) revert MintingNotOpen();
        if (totalMinted >= GENESIS_PHASE_SUPPLY) revert GenesisPhaseOver();

        _burnExact(msg.sender, GENESIS_PRICE);

        tokenId = ++totalMinted;
        Tier tier = tokenId == 1 ? Tier.LegendaryGenesis : Tier.Genesis;
        _tier[tokenId] = tier;
        _artworkId[tokenId] = uint16(tokenId);
        emit GenesisMinted(msg.sender, tokenId, uint16(tokenId), GENESIS_PRICE);
        emit Revealed(tokenId, tier, uint16(tokenId), false);

        _safeMint(msg.sender, tokenId);
    }

    /// @notice Phase 2: burn 350,000 BMC and mint a pending pass. Its outcome is settled by `reveal`
    ///         from the hash of the next block, so nothing in this transaction can observe or
    ///         select it: a caller that reverts only forfeits its own mint.
    /// @dev Block-derived entropy is manipulable; there is no fairness or unpredictability guarantee.
    function mintMystery() external nonReentrant returns (uint256 tokenId) {
        if (!mintingOpen) revert MintingNotOpen();
        if (totalMinted < GENESIS_PHASE_SUPPLY) revert GenesisPhaseNotOver();
        if (totalMinted >= MAX_SUPPLY) revert SoldOut();

        _burnExact(msg.sender, MYSTERY_PRICE);
        tokenId = ++totalMinted;
        _mintBlock[tokenId] = block.number;
        emit MysteryMinted(msg.sender, tokenId, MYSTERY_PRICE, block.number + 1);
        _safeMint(msg.sender, tokenId);
    }

    /// @notice Settles up to `maxCount` pending mystery tokens in mint order. Callable by anyone;
    ///         the result does not depend on who calls or when, only on the reveal block's hash.
    ///         Stops at the first token whose reveal block is not finalized yet.
    /// @return revealed Number of tokens settled by this call.
    function reveal(uint256 maxCount) external returns (uint256 revealed) {
        uint256 tokenId = GENESIS_PHASE_SUPPLY + revealedCount + 1;
        uint256 minted = totalMinted;
        while (revealed < maxCount && tokenId <= minted) {
            uint256 revealBlock = _mintBlock[tokenId] + 1;
            if (revealBlock >= block.number) break;
            bytes32 hash = _blockHashOf(revealBlock);
            if (hash == bytes32(0)) {
                // Window expired without a reveal: settle as Standard so that waiting never pays.
                _drawStandard(tokenId, uint256(keccak256(abi.encode(address(this), tokenId))));
            } else {
                _draw(tokenId, uint256(keccak256(abi.encode(hash, address(this), tokenId))), false);
            }
            ++revealed;
            ++tokenId;
        }
    }

    /// @dev Hash of block `n`: native for the last 256 blocks, EIP-2935 history for the last 8,191.
    ///      Returns zero when unavailable (too old, or the history contract is absent).
    function _blockHashOf(uint256 n) private view returns (bytes32) {
        if (n >= block.number) return bytes32(0);
        uint256 age = block.number - n;
        if (age <= 256) return blockhash(n);
        if (age > REVEAL_WINDOW) return bytes32(0);
        (bool ok, bytes memory data) = BLOCK_HISTORY.staticcall(abi.encode(n));
        if (!ok || data.length != 32) return bytes32(0);
        return abi.decode(data, (bytes32));
    }

    /// @dev Burns exactly `amount` BMC from `payer` via burnFrom and verifies the burn happened.
    function _burnExact(address payer, uint256 amount) private {
        if (address(BMC).code.length == 0) revert BMCTokenUnavailable();
        uint8 dec = BMC.decimals();
        if (dec != BMC_DECIMALS) revert UnexpectedTokenDecimals(dec);
        uint256 supplyBefore = BMC.totalSupply();
        uint256 balanceBefore = BMC.balanceOf(payer);
        BMC.burnFrom(payer, amount);
        uint256 supplyDelta = supplyBefore - BMC.totalSupply();
        uint256 balanceDelta = balanceBefore - BMC.balanceOf(payer);
        if (supplyDelta != amount || balanceDelta != amount) revert BurnMismatch(amount, supplyDelta);
        totalBurned += amount;
        assert(totalBurned <= MAX_TOTAL_BURN);
    }

    /// @dev Draw one outcome without replacement using a virtual Fisher-Yates shuffle (O(1) gas).
    function _draw(uint256 tokenId, uint256 word, bool forced) private {
        uint256 remaining = MYSTERY_SUPPLY - revealedCount;
        uint256 r = uint256(keccak256(abi.encode(word, tokenId))) % remaining;
        _settle(tokenId, r, remaining, forced);
    }

    /// @dev Expired-window fallback: take the first Standard slot at or after a pseudo-random
    ///      position. At most 37 Genesis slots exist, so the scan is bounded; if only Genesis slots
    ///      remain the token receives one of them.
    function _drawStandard(uint256 tokenId, uint256 word) private {
        uint256 remaining = MYSTERY_SUPPLY - revealedCount;
        uint256 r = uint256(keccak256(abi.encode(word, tokenId))) % remaining;
        for (uint256 i; i < remaining; ++i) {
            uint256 idx = (r + i) % remaining;
            if (_slotValue(idx) >= MYSTERY_GENESIS) {
                r = idx;
                break;
            }
        }
        _settle(tokenId, r, remaining, true);
    }

    function _settle(uint256 tokenId, uint256 r, uint256 remaining, bool forced) private {
        uint256 picked = _slotValue(r);
        uint256 last = _slotValue(remaining - 1);
        _slotSwap[r] = last + 1;
        delete _slotSwap[remaining - 1];

        revealedCount += 1;

        Tier tier;
        uint16 artwork;
        if (picked < MYSTERY_GENESIS) {
            tier = Tier.Genesis;
            artwork = uint16(GENESIS_PHASE_SUPPLY + 1 + picked); // genesis-41 .. genesis-77
            mysteryGenesisRevealed += 1;
        } else {
            tier = Tier.Standard;
            artwork = uint16(picked - MYSTERY_GENESIS + 1); // standard 1 .. 423
        }
        _tier[tokenId] = tier;
        _artworkId[tokenId] = artwork;
        emit Revealed(tokenId, tier, artwork, forced);
    }

    function _slotValue(uint256 i) private view returns (uint256) {
        uint256 s = _slotSwap[i];
        return s == 0 ? i : s - 1;
    }

    // ------------------------------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------------------------------

    function tierOf(uint256 tokenId) external view returns (Tier) {
        _requireMinted(tokenId);
        return _tier[tokenId];
    }

    /// @notice Artwork identifier: for Genesis tiers the genesis-NN number (1..77); for Standard the
    ///         on-chain artwork index (1..423); 0 while a mystery token is pending.
    function artworkIdOf(uint256 tokenId) external view returns (uint16) {
        _requireMinted(tokenId);
        return _artworkId[tokenId];
    }

    function revealStatusOf(uint256 tokenId) external view returns (RevealStatus) {
        _requireMinted(tokenId);
        if (_tier[tokenId] != Tier.Pending) return RevealStatus.Revealed;
        return _mintBlock[tokenId] + 1 < block.number ? RevealStatus.RandomnessStored : RevealStatus.AwaitingRandomness;
    }

    /// @notice Block whose hash settles a mystery token (0 for Genesis-phase tokens).
    function revealBlockOf(uint256 tokenId) external view returns (uint256) {
        _requireMinted(tokenId);
        return tokenId <= GENESIS_PHASE_SUPPLY ? 0 : _mintBlock[tokenId] + 1;
    }

    /// @notice Last block in which a pending mystery token can still be settled from its reveal
    ///         block hash; afterwards `reveal` settles it as Standard.
    function revealDeadlineOf(uint256 tokenId) external view returns (uint256) {
        _requireMinted(tokenId);
        return tokenId <= GENESIS_PHASE_SUPPLY ? 0 : _mintBlock[tokenId] + 1 + REVEAL_WINDOW;
    }

    /// @notice Next mystery token id that `reveal` will settle (0 when nothing is pending).
    function nextRevealId() external view returns (uint256) {
        uint256 id = GENESIS_PHASE_SUPPLY + revealedCount + 1;
        return id <= totalMinted ? id : 0;
    }

    function totalSupply() external view returns (uint256) {
        return totalMinted;
    }

    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    function genesisPhaseActive() external view returns (bool) {
        return totalMinted < GENESIS_PHASE_SUPPLY;
    }

    /// @notice Mystery mint positions not yet sold.
    function remainingMysteryMints() external view returns (uint256) {
        return totalMinted < GENESIS_PHASE_SUPPLY ? MYSTERY_SUPPLY : MAX_SUPPLY - totalMinted;
    }

    /// @notice Mystery tokens minted but not yet settled by `reveal`.
    function pendingReveals() external view returns (uint256) {
        return totalMinted > GENESIS_PHASE_SUPPLY ? totalMinted - GENESIS_PHASE_SUPPLY - revealedCount : 0;
    }

    /// @notice Outcomes still inside the pool, available to future mystery mints.
    function remainingMysteryGenesis() external view returns (uint256) {
        return MYSTERY_GENESIS - mysteryGenesisRevealed;
    }

    function remainingMysteryStandard() external view returns (uint256) {
        return TOTAL_STANDARD - (revealedCount - mysteryGenesisRevealed);
    }

    /// @notice Current price of the next mint in BMC units, 0 when sold out.
    function currentPrice() external view returns (uint256) {
        if (totalMinted >= MAX_SUPPLY) return 0;
        return totalMinted < GENESIS_PHASE_SUPPLY ? GENESIS_PRICE : MYSTERY_PRICE;
    }

    function _requireMinted(uint256 tokenId) private view {
        if (tokenId == 0 || tokenId > totalMinted) revert NonexistentToken(tokenId);
    }

    // ------------------------------------------------------------------------------------------
    // Metadata (fully on-chain JSON)
    // ------------------------------------------------------------------------------------------

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        Tier tier = _tier[tokenId];
        string memory json;
        if (tier == Tier.Pending) {
            json = _pendingJson(tokenId);
        } else if (tier == Tier.Standard) {
            json = _standardJson(tokenId, _artworkId[tokenId]);
        } else {
            json = _genesisJson(tokenId, tier, _artworkId[tokenId]);
        }
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @notice Raw SVG of a Standard token (reverts for other tiers).
    function standardSVG(uint256 tokenId) external view returns (string memory) {
        _requireMinted(tokenId);
        require(_tier[tokenId] == Tier.Standard, "not standard");
        return StandardArt.render(_artworkId[tokenId]);
    }

    function _genesisFile(uint16 artwork) private pure returns (string memory) {
        return string.concat("genesis-", artwork < 10 ? "0" : "", uint256(artwork).toString(), ".png");
    }

    function _genesisJson(uint256 tokenId, Tier tier, uint16 artwork) private pure returns (string memory) {
        bool legendary = tier == Tier.LegendaryGenesis;
        string memory file = _genesisFile(artwork);
        string memory head = string.concat(
            '{"name":"BMC Illuminati Pass #',
            tokenId.toString(),
            legendary ? " - Legendary Genesis" : " - Genesis",
            '","description":"',
            legendary
                ? "The one. The first BMC Illuminati Pass ever minted: the Legendary Genesis, the rarest piece of the 500-piece collection. A mysterious hooded frog with a glowing golden third eye, crowned and veiled, beneath the floating golden eye-in-triangle. Minted by permanently burning 1,000,000 BMC."
                : "A Genesis BMC Illuminati Pass. A mysterious cartoon frog in a black hooded cloak with premium gold-and-black styling, a glowing golden third eye and a floating golden eye-in-triangle. One of 77 Genesis pieces in a 500-piece collection minted by permanently burning BMC.",
            '","image":"ipfs://',
            genesisImagesCID,
            "/",
            file
        );
        string memory attrs = string.concat(
            '","attributes":[{"trait_type":"Tier","value":"',
            legendary ? "Legendary Genesis" : "Genesis",
            '"},{"trait_type":"Artwork","value":"',
            file,
            '"},{"trait_type":"Cloak","value":"Black Hooded, Gold Trim"},{"trait_type":"Third Eye","value":"Glowing Gold"},{"trait_type":"Sigil","value":"Floating Golden Eye-in-Triangle"}',
            legendary
                ? ',{"trait_type":"Crown","value":"Legendary Golden Crown"},{"trait_type":"Aura","value":"Radiant Gold Halo"},{"trait_type":"Rank","value":"First Minter"}'
                : "",
            ',{"trait_type":"Genesis Number","display_type":"number","value":',
            uint256(artwork).toString(),
            "}]}"
        );
        return string.concat(head, attrs);
    }

    /// @dev Neutral metadata while a mystery token awaits its reveal; nothing about the outcome leaks.
    function _pendingJson(uint256 tokenId) private view returns (string memory) {
        string memory svg =
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='#05070b'/><circle cx='200' cy='200' r='120' fill='none' stroke='#d4af37' stroke-width='6'/><text x='200' y='212' fill='#d4af37' font-family='serif' font-size='30' text-anchor='middle'>UNREVEALED</text></svg>";
        return string.concat(
            '{"name":"BMC Illuminati Pass #',
            tokenId.toString(),
            ' - Unrevealed","description":"A BMC Illuminati Pass awaiting its reveal. Its outcome is settled from the hash of Ethereum block ',
            (_mintBlock[tokenId] + 1).toString(),
            ' when anyone calls reveal; after the reveal window it settles as Standard. Minted by permanently burning 350,000 BMC.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Tier","value":"Unrevealed"},{"trait_type":"Reveal Block","display_type":"number","value":',
            (_mintBlock[tokenId] + 1).toString(),
            "}]}"
        );
    }

    function _standardJson(uint256 tokenId, uint16 artwork) private pure returns (string memory) {
        return string.concat(
            '{"name":"BMC Illuminati Pass #',
            tokenId.toString(),
            ' - Standard","description":"A Standard BMC Illuminati Pass. An original cartoon frog in a dark hooded cloak, rendered fully on-chain as SVG. One of 423 Standard pieces in a 500-piece collection minted by permanently burning BMC.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(StandardArt.render(artwork))),
            '","attributes":[{"trait_type":"Tier","value":"Standard"},{"trait_type":"Artwork","value":"standard-',
            uint256(artwork).toString(),
            '"},',
            StandardArt.attributesJson(artwork),
            "]}"
        );
    }
}
