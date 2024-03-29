// Import CSS styles and Pixel component
import "./App.css";
import "./Pixel";
import "@massalabs/react-ui-kit/src/global.css";
import { useCallback, useEffect, useState } from "react";
import React from 'react';
// Import types and utilities from massa-web3 and wallet-provider packages
import { IAccount, providers } from "@massalabs/wallet-provider";
import {
  ClientFactory,
  Args,
  Client,
  bytesToStr,
  fromMAS,
  EventPoller, 
  IEventRegexFilter,
  INodeStatus,
  MAX_GAS_EXECUTE_SC,
  CHAIN_ID,
  DefaultProviderUrls
} from "@massalabs/massa-web3";
import Pixel from "./Pixel";
// Import logo images
import MassaLogo from './massa_logo.png';
import GithubLogo from './github_logo.png';
import MassaStationLogo from './massastation.svg';

// Constants for contract address and chain ID
const CONTRACT_ADDRESS = "AS1BgCN9W5gBjENyMHHXvwLHkBt7tYown3ojVWnmWYZWbsGqMkdo";
const chainId = CHAIN_ID.BuildNet;
const DefaultProviderUrl = DefaultProviderUrls.BUILDNET;

function App() {
  // State variables for web3 clients, Massa client, pixels, and UI controls
  const [web3clients, setWeb3clients] = useState<ProviderAccounts[]>([]);
  const [client, setWeb3Client] = useState<Client | null>(null);
  const [defaultClient, setDefaultClient] = useState<Client | null>(null);
  const [pixels, setPixels] = useState<Array<{ x: number; y: number; color: string; owner: string; price: number }>>([]);
  const [newPrice, setNewPrice] = useState("");
  const [newColor, setNewColor] = useState('#000000'); // Initial color state for new color 
  const [nodeStatusInfo, setNodeStatusInfo] = useState<INodeStatus | null>(null);
  const [isPollingStarted, setIsPollingStarted] = useState<boolean>(false);
  const [selectedPixels, setSelectedPixels] = useState<PixelSimple[]>([]);
  const [isSelecting, setIsSelecting] = useState(false); // New state to track if selection is active
  
  // Simplified Pixel type for selected pixels
  type PixelSimple = {
    x: number;
    y: number;
    price: number;
    color: string;
  };
  

    // This effect runs when `defaultClient` and `nodeStatusInfo` are updated.
  useEffect(() => {
    // Check if both `defaultClient` and `nodeStatusInfo` are available to start polling for events.
    if (defaultClient && nodeStatusInfo) {
      // Define the filter for events to poll. This includes the last known slot from node status,
      // the contract address to listen to, and a regex pattern for event names of interest.
      const eventsFilter: IEventRegexFilter = {
        start: nodeStatusInfo.last_slot, // Start polling from the last known slot
        end: null, // Poll up to the current slot
        original_operation_id: null,
        original_caller_address: null,
        emitter_address: CONTRACT_ADDRESS, // Only events emitted by this contract address
        is_final: null,
        eventsNameRegex: "Massa Place", // Filter events with names matching this regex
      };

      const pollIntervalMillis = 1000; // Set the polling frequency to 1000 milliseconds (1 second)
        
      // Start polling for events using the defined filter and interval. Process each event data
      // to update the application state based on the event type and content.
      const eventPoller = EventPoller.startEventsPolling(
        eventsFilter,
        pollIntervalMillis,
        defaultClient,
        (data) => {
          // Iterate over each event received from the poller
          data.forEach((event) => {
            console.log(event);
            const eventData = event.data.split(",");
            // Handle "buyPixel" events to update the owner and color of a pixel
            if (eventData[0] === "Massa Place:buyPixel") {
              const x = parseInt(eventData[1], 10);
              const y = parseInt(eventData[2], 10);
              const newOwner = eventData[3];
              const newColor = "000000"; // Set the color to black for purchased pixels
          
              // Update the pixels state to reflect the new owner and color
              setPixels((currentPixels) => {
                return currentPixels.map((pixel) => {
                  if (pixel.x === x && pixel.y === y) {
                    return { ...pixel, owner: newOwner, color: `#${newColor}` };
                  }
                  return pixel;
                });
              });
            }
            // Handle "colorChange" events to update the color of a pixel
            else if (eventData[0] === "Massa Place:colorChange") {
              const x = parseInt(eventData[1], 10);
              const y = parseInt(eventData[2], 10);
              const newColor = eventData[3]; // Color specified in the event
              
              // Update the pixels state to reflect the new color
              setPixels((currentPixels) => currentPixels.map((pixel) => {
                if (pixel.x === x && pixel.y === y) {
                  const formattedColor = newColor.startsWith("#") ? newColor : `#${newColor}`;
                  return { ...pixel, color: formattedColor };
                }
                return pixel;
              }));
            }
            // Handle "changePrice" events to update the price of a pixel
            else if (eventData[0] === "Massa Place:changePrice") {
              const x = parseInt(eventData[1], 10);
              const y = parseInt(eventData[2], 10);
              const newPrice = parseFloat(eventData[3]); // New price specified in the event
            
              // Update the pixels state to reflect the new price
              setPixels((currentPixels) => currentPixels.map((pixel) => {
                if (pixel.x === x && pixel.y === y) {
                  return { ...pixel, price: newPrice };
                }
                return pixel;
              }));
            }
          });
        },
        (error) => {
          // Log an error if polling fails
          console.error('Error during polling:', error);
        }
      );
      
      // Mark that polling has started
      setIsPollingStarted(true);

      // Cleanup function to stop polling when the component unmounts or the dependencies change
      return () => {
        eventPoller.stopPolling();
      };
    }
  // This effect depends on changes in `defaultClient` and `nodeStatusInfo`
  }, [defaultClient, nodeStatusInfo]);

  
  // Initialize the default client and node status on component mount
  useEffect(() => {
    // Asynchronously initialize the default Massa client using the ClientFactory
    const initDefaultClient = async () => {
      const client: Client = await ClientFactory.createDefaultClient(
        DefaultProviderUrl, // URL of the default provider
        chainId, // Chain ID to connect to
        true, // Enable retrying failed requests
      );
      setDefaultClient(client); // Set the initialized client in state

      // Fetch and set the current node status information
      const nodeStatusInfo = await client.publicApi().getNodeStatus();
      setNodeStatusInfo(nodeStatusInfo);
    };

    // Execute the initialization and catch any errors
    initDefaultClient().catch(console.error);
  }, []);

  // Fetch canvas colors when the default client is set
  useEffect(() => {
    if(defaultClient) {
      // Schedule the fetchCanvasColors function immediately after component mount
      const timeoutId = setTimeout(() => fetchCanvasColors(0, 0), 0);

      // Cleanup function to clear the timeout if the component unmounts or the dependency changes
      return () => clearTimeout(timeoutId);
    }
  }, [defaultClient]);

  // Fetch accounts from providers on component mount
  useEffect(() => {
    getAccounts(); // Fetch accounts associated with available providers
  }, []);

  // Functions to manage pixel selection state
  const startSelecting = () => {
    setIsSelecting(true); // Start selecting pixels
  };

  const stopSelecting = () => {
    setIsSelecting(false); // Stop selecting pixels
  };

  // Handle click on a pixel, selecting or deselecting it
  const handlePixelClick = useCallback((pixel: PixelSimple) => {
    if (!isSelecting) {
      setSelectedPixels((prevSelectedPixels) => {
        const index = prevSelectedPixels.findIndex(p => p.x === pixel.x && p.y === pixel.y);
        if (index > -1) {
          // Deselect the pixel if it's already selected
          return prevSelectedPixels.filter((_, i) => i !== index);
        } else {
          // Select the pixel if it's not already selected
          return [...prevSelectedPixels, pixel];
        }
      });
    }
  }, [isSelecting]);

  // Handle mouse enter on a pixel, selecting it during a selection operation
  const handlePixelEnter = useCallback((pixel: PixelSimple) => {
    if (isSelecting) {
      setSelectedPixels((prevSelectedPixels) => {
        const isPixelAlreadySelected = prevSelectedPixels.some(p => p.x === pixel.x && p.y === pixel.y);
        if (!isPixelAlreadySelected) {
          // Add the pixel to selection if not already selected
          return [...prevSelectedPixels, pixel];
        }
        return prevSelectedPixels;
      });
    }
  }, [isSelecting]);

  const selectAllPixels = () => {
    setSelectedPixels(pixels); // Supposons que allPixels est un tableau contenant tous les pixels
  };

  // Type definitions for accounts and providers
  interface AccountInfo {
    providerName: string;
    account: IAccount;
  }

  interface AccountsByProvider {
    [providerName: string]: AccountInfo[];
  }

  interface ProviderAccounts {
    providerName: string;
    accounts: IAccount[];
  }

  
  // Fetches and organizes wallet accounts from all available providers
  const getAccounts = async () => {
    const providersList = await providers(true); // Get all providers that support account management
    let accountsByProvider: AccountsByProvider = {}; // Initialize an object to hold accounts categorized by provider

    // Iterate through each provider to fetch and organize accounts
    for (const provider of providersList) {
      try {
        const accounts = await provider.accounts(); // Fetch accounts from the provider
        if (accounts.length > 0) {
          // Ensure the provider's name is initialized in the object
          accountsByProvider[provider.name()] = accountsByProvider[provider.name()] || [];
          // Add each account under its provider's name
          accounts.forEach(account => {
            accountsByProvider[provider.name()].push({
              providerName: provider.name(),
              account
            });
          });
        }
      } catch (error) {
        // Log any errors encountered during account fetching
        console.error(`Error fetching accounts for provider ${provider.name()}:`, error);
      }
    }

    // Map the organized accounts into an array suitable for state management and UI rendering
    const accountsInfo = Object.entries(accountsByProvider).map(([providerName, accounts]) => ({
      providerName,
      accounts: accounts.map(accountInfo => accountInfo.account) // Extract only the account info
    }));

    setWeb3clients(accountsInfo); // Update component state with the organized accounts
  };

  // Initializes and sets a Web3 client with the selected account
  const selectClient = async (selectedAccount: IAccount) => {
    try {
      // Find the provider corresponding to the selected account
      const WalletProvider = (await providers(true)).find(p => p.name() === selectedAccount.providerName());
      if (!WalletProvider) {
        // If no matching provider is found, throw an error
        throw new Error("Selected wallet provider not found");
      }

      // Initialize a Web3 client with the selected account using the found provider
      const client = await ClientFactory.fromWalletProvider(WalletProvider, selectedAccount, false);
      setWeb3Client(client); // Set the initialized client in the component state
      // Fetch and set the current node status for further interactions
      const nodeStatusInfo = await client.publicApi().getNodeStatus();
      setNodeStatusInfo(nodeStatusInfo);
    } catch (error) {
      // Log any errors encountered during client selection
      console.error("Error selecting client:", error);
    }
  };


  // Fetches pixel data from the smart contract and updates the state with the new data.
  const fetchCanvasColors = async (startX = 0, startY = 0, accumulatedPixels = Array<{ x: number; y: number; color: string; owner: string; price: number }>()) => {
    // Exit if the defaultClient is not available
    if (!defaultClient) return;

    try {
        // Prepare arguments for the smart contract call to get pixel details
        const args = new Args().addU32(startX).addU32(startY).serialize();
        // Call the smart contract to read all pixel details starting from the specified coordinates
        const res = await defaultClient.smartContracts().readSmartContract({
            targetAddress: CONTRACT_ADDRESS,
            targetFunction: "getAllPixelsDetails",
            parameter: args,
            maxGas: BigInt(MAX_GAS_EXECUTE_SC), // Maximum gas allowed for the transaction
        });

        // Decode the returned bytes to a string and split into individual pixel data entries
        const fullStr = bytesToStr(res.returnValue);
        let entries = fullStr.split("|");
        // Remove and log the gas information, which is the last entry of the returned data
        const gasInfo = entries.pop();
        console.log("Gas Info:", gasInfo);
        
        // Map each entry to a pixel object and accumulate them
        const pixelsData = entries.map(entry => {
            const [x, y, color, owner, price] = entry.split(",");
            return {
                x: parseInt(x, 10),
                y: parseInt(y, 10),
                color: `#${color}`, // Prepend '#' to the color value
                owner,
                price: parseFloat(price),
            };
        });
        
        // Combine the newly fetched pixels with previously accumulated ones
        const newAccumulatedPixels = accumulatedPixels.concat(pixelsData);
        console.log("Data fetched:", pixelsData);

        // Check if all pixels have been fetched based on an expected total
        const newTotalPixelsFetched = newAccumulatedPixels.length;
        console.log(`Total pixels fetched: ${newTotalPixelsFetched}`);
        const expectedTotalPixels = 100 * 100; // Assuming a 100x100 grid for simplicity

        // If not all pixels are fetched, calculate new start coordinates and fetch more
        if (newTotalPixelsFetched < expectedTotalPixels) {
            let nextStartX = startX + ((startY + pixelsData.length) / 100) | 0;
            let nextStartY = (startY + pixelsData.length) % 100;
            console.log(`Fetching more starting from ${nextStartX}, ${nextStartY}`);
            fetchCanvasColors(nextStartX, nextStartY, newAccumulatedPixels);
        } else {
            // If all pixels are fetched, update the state with the complete list
            console.log("All pixels fetched successfully.");
            setPixels(newAccumulatedPixels);
        }
    } catch (error) {
        console.error("Error fetching pixel data:", error);
    }
  };


  // Attempts to buy selected pixels on the blockchain
  async function buyPixels() {
    // Exit if there's no client or no pixels are selected
    if (!client || selectedPixels.length === 0) return;
    
    try {
      // Prepare arguments for the smart contract call
      let args = new Args().addString(selectedPixels.length.toString());
      selectedPixels.forEach(pixel => {
        // For each selected pixel, add its coordinates and price to the arguments
        args.addU32(pixel.x).addU32(pixel.y).addString(pixel.price.toString());
      });
    
      // Serialize arguments for transmission
      const serializedArgs = args.serialize();
      // Calculate the total price of all selected pixels
      const totalPrice = selectedPixels.reduce((sum, { price }) => sum + price + 0.05, 0);
    
      // Call the smart contract function to buy pixels
      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "buyPixels",
        parameter: serializedArgs,
        maxGas: BigInt(3980167295),
        coins: BigInt(fromMAS(totalPrice)), // Total price for the transaction
        fee: BigInt(fromMAS(1)), // Transaction fee
      });
      console.log(`Attempted to buy ${selectedPixels.length} pixels`);
    } catch (error) {
      console.error("Error buying pixels:", error);
    }
  }


  // Updates the price for multiple selected pixels
  const updateMultiplePixelsPrice = async () => {
    // Exit if there's no client
    if (!client) return;
    try {
      // Initialize arguments with the number of pixels to modify
      let args = new Args().addString(selectedPixels.length.toString());
      
      // For each selected pixel, add its coordinates and new price to the arguments
      selectedPixels.forEach(pixel => {
        args = args.addU32(pixel.x).addU32(pixel.y).addString(newPrice);
      });

      // Serialize arguments for transmission
      const serializedArgs = args.serialize();

      // Call the smart contract function to update pixel prices
      await client.smartContracts().callSmartContract({
        targetAddress: CONTRACT_ADDRESS,
        functionName: "setMultiplePixelsPrice",
        parameter: serializedArgs,
        maxGas: BigInt(3980167295),
        coins: BigInt(0), // No coins needed for this operation
        fee: BigInt(fromMAS(0.1)), // Ensure sufficient fee to cover the transaction
      });
      console.log(`Prices updated for multiple pixels.`);
    } catch (error) {
      console.error("Error updating pixel prices:", error);
    }
  }

  // Asynchronous function to change the color of multiple selected pixels
  async function changeMultiplePixelsColor() {
    // Return early if there's no client initialized or no pixels selected
    if (!client || selectedPixels.length === 0) return;

    try {
      // Initialize an Args object for constructing the smart contract call arguments
      let args = new Args().addString(selectedPixels.length.toString());
      // For each selected pixel, add its coordinates and the new color (excluding the hash symbol) to the arguments
      selectedPixels.forEach(pixel => {
          const colorWithoutHash = newColor.slice(1); // Remove the '#' from the color value
          args.addU32(pixel.x).addU32(pixel.y).addString(colorWithoutHash);
      });

      // Serialize the constructed arguments for the smart contract call
      const serializedArgs = args.serialize();

      // Execute the smart contract call to change the color of the selected pixels
      await client.smartContracts().callSmartContract({
          targetAddress: CONTRACT_ADDRESS, // The address of the smart contract
          functionName: "changeMultiplePixelsColor", // The function to call within the smart contract
          parameter: serializedArgs, // The serialized arguments for the smart contract function
          maxGas: BigInt(3980167295), // The maximum gas allowed for the call
          coins: BigInt(0), // No MAS coins required for changing color, adjust if necessary
          fee: BigInt(fromMAS(0.1)), // The fee for executing the call
      });
      console.log(`Attempted to change colors of ${selectedPixels.length} pixels`);
      setSelectedPixels([]); // Clear the selection after changing the colors
      // Optionally, refresh pixel data after a delay
      //setTimeout(fetchCanvasColors, 5000);
    } catch (error) {
        console.error("Error changing pixels color:", error);
    }
  }

  async function resetSelection(){
    setSelectedPixels([]);
  }

  // Utilizes useMemo for performance optimization by memoizing the set of selected pixels. 
  // This reduces unnecessary recalculations by rebuilding the set only when the `selectedPixels` array changes.
  // Each selected pixel is represented as a string in the format "x,y" to facilitate quick lookups 
  // and determine if a pixel is selected. This is used for rendering logic in the UI.
  const selectedPixelSet = React.useMemo(() => new Set(selectedPixels.map(p => `${p.x},${p.y}`)), [selectedPixels]);

  return (
    <div className="App">
      {/* Header section with links and logos */}
      <div className="header">
        {/* Left header with GitHub logo/link */}
        <div className="left-header">
          <a href="https://github.com/itrider-gh/massa-place">
            <img src={GithubLogo} alt="Github Logo" width="30px" height="30px" />
          </a>
          <div>v0.10.1</div>
          <div>buildnet</div>
        </div>
        {/* Mid header with application logo and title */}
        <div className="mid-header">
          <img src={MassaLogo} alt="Massa Logo" width="50px" height="50px" />
          <h1>Massa Place</h1>
        </div>
        {/* Right header for wallet provider connections */}
        <div className="right-header">
          {web3clients.map(({ providerName, accounts }, index) => (
            <div key={index} className="provider-container">
              <div className="provider-name">
                {providerName === "MASSASTATION" ? (
                  <img src={MassaStationLogo} alt="MassaStation Logo" width="30" height="30" />
                ) : (
                  <span>{providerName}</span>
                )}
              </div>
              {accounts.map((account, accountIndex) => (
                <button
                  key={accountIndex}
                  className="connect-button"
                  style={{ backgroundColor: client?.wallet().getBaseAccount()?.address() === account.address() ? 'green' : 'initial' }}
                  onClick={() => selectClient(account)}
                >
                  Connect {account.name()}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Canvas container for pixel selection and interaction */}
      <div className="canvas-container"
           onMouseDown={startSelecting}
           onMouseUp={stopSelecting}
           onMouseLeave={stopSelecting}>
        <div className="canvas">
          {pixels.map((pixel) => {
            const pixelKey = `${pixel.x},${pixel.y}`;
            const isSelected = selectedPixelSet.has(pixelKey);
            return (
              <Pixel
                key={pixelKey}
                pixel={pixel}
                isSelected={isSelected}
                onClick={(e, pixel) => { e.preventDefault(); handlePixelClick(pixel); }}
                onEnter={() => handlePixelEnter(pixel)}
              />
            );
          })}
        </div>
      </div>
      {/* Buttons for actions on selected pixels */}
      {selectedPixels.length > 0 && (
        <div className="buttons-container">
          <button onClick={resetSelection}>Reset Selection</button>
          <button onClick={buyPixels}>Buy Selected Pixels</button>
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
          />
          <button onClick={changeMultiplePixelsColor}>Apply New Color</button>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="New Price"
          />
          <button onClick={updateMultiplePixelsPrice}>Update Price for Selected Pixels</button>
          {/* Ajout du bouton pour sélectionner tous les pixels */}
          <button onClick={selectAllPixels}>Select All Pixels</button>
        </div>
      )}
    </div>
  );  
}

export default App;
