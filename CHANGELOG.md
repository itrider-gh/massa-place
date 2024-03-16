All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.2] - 2024-03-16

Version in which buying, selling, changing pixel metadata (color) works. Intra smart contract error handling no longer allows you to lose the amount at stake in a transaction when a smart contract call fails. 

The front end enables the use of every smart contract function (except for the getPixelColor function, whose use is still under review). 

## [v0.1.3] - 2024-03-16

### Added
- Initial owner set to "not_yet_owned" in Smart Contracts (SC).
- Pricing & buying method in SC.
- Buying method for a specific pixel in frontend.
- Clickable pixel on canvas.

## [v0.1.2] - 2024-03-15

### Added
- Ownership functionality for pixels.
- Initial pixels are set to null color and owned by 'itrider'.

### Removed
- `hashToHexColor` function from the contract.

### Changed
- Modified get methods to comply with the new pixel structure.
- Added error throwing in smart contract to cancel transactions in case of errors.

## [v0.1.1] - 2024-03-15

### Added
- Second version with write function (change pixel colors) in Smart Contracts (SC).

## [v0.1] - 2024-03-14

### Added
- Function to return the remaining gas at the end of the execution.

## [v0.0.2] - 2024-03-14

### Added
- SC function to get all pixels in an array.

## [v0.0.1] - 2024-03-14

### Added
- First version with small canvas, fetching their colors in the SC datastore.

---

Make sure to replace `[date]` with the actual date you intend to release version v0.1.3.