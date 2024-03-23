All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10] - 2024-03-22

### Added
- Enhanced frontend, including an improved header design.
- Functionality to fragment the fetch of the pixel array and adapt the frontend to comply.
- Modification to default wallet initialization with default Massa client.
- Button to connect to an external wallet provider.
- Button to reset pixel selection.
- Reset selection button.
- Event and hook mechanism for when pixel state changes to update the canvas without needing to fetch all pixels' states again.

## [0.9] - 2024-03-19

### Added
- Function in Smart Contracts (SC) to buy several pixels at the same time.
- Function in Smart Contracts (SC) to change the color of several pixels at the same time.
- Function in Smart Contracts (SC) to change the price of several pixels at the same time.

## [0.8] - 2024-03-16

Version in which buying, selling, and changing pixel metadata (color) works. Intra smart contract error handling has been improved to prevent the loss of the amount at stake in a transaction when a smart contract call fails. 

The frontend now supports the use of every smart contract function, except for the getPixelColor function, which is still under review.

## [0.7] - 2024-03-16

### Added
- Initial owner set to "not_yet_owned" in Smart Contracts (SC).
- Pricing & buying method in SC.
- Buying method for a specific pixel in the frontend.
- Clickable pixel on the canvas.

## [0.6] - 2024-03-15

### Added
- Ownership functionality for pixels.
- Initial pixels are set to a null color and owned by 'itrider'.

### Removed
- `hashToHexColor` function from the contract.

### Changed
- Modified get methods to comply with the new pixel structure.
- Added error throwing in smart contracts to cancel transactions in case of errors.

## [0.5] - 2024-03-15

### Added
- Second version with write function (change pixel colors) in Smart Contracts (SC).

## [0.4] - 2024-03-14

### Added
- Function to return the remaining gas at the end of the execution.

## [0.3] - 2024-03-14

### Added
- SC function to get all pixels in an array.

## [0.2] - 2024-03-14

### Added
- First version with a small canvas, fetching their colors in the SC datastore.