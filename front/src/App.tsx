import "./App.css";
import "@massalabs/react-ui-kit/src/global.css"; // Importing global styles
import { useEffect, useState } from "react"; // React hooks for state and lifecycle management
import { IAccount, providers } from "@massalabs/wallet-provider"; // Massa wallet provider for user account management
import {
  ClientFactory,
  Args,
  Client,
  bytesToStr,
} from "@massalabs/massa-web3"; // Massa Web3 client for smart contract interactions

// Smart contract address on the Massa blockchain
const CONTRACT_ADDRESS = "AS1oYADtgD9xA9LcCJUDjwYiaHtafD7KUu8Fhroe24FbxepxWSPz";

function App() {
  const [client, setWeb3client] = useState<Client | null>(null); // State for the Massa Web3 client
  const [pixels, setPixels] = useState<Array<string>>(Array(100).fill("#FFFFFF")); // State for storing the pixel colors

  // Initialize the Massa Web3 client using the Bearby provider
  useEffect(() => {
    const initClientWithBearby = async () => {
      // Fetching the list of providers and selecting Bearby
      const bearbyProvider = (await providers(true)).find(p => p.name() === "BEARBY");

      if (!bearbyProvider) {
        console.error("Bearby provider not found");
        return;
      }

      // Fetching user accounts from the Bearby provider
      const accounts = await bearbyProvider.accounts();
      if (accounts.length === 0) {
        console.error("No accounts found with Bearby provider");
        return;
      }

      // Initializing the Massa Web3 client with the Bearby wallet provider and the first account
      const client = await ClientFactory.fromWalletProvider(bearbyProvider, accounts[0], false);
      setWeb3client(client);
    };

    initClientWithBearby().catch(console.error);
  }, []);

  // Fetch the colors of the canvas pixels from the smart contract
  useEffect(() => {
    const fetchCanvasColors = async () => {
      if (!client) return; // Ensure the client is initialized
      
      const newPixels = [...pixels]; // Clone the current pixels state
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          try {
            // Serializing the arguments for the smart contract call
            const args = new Args().addU32(x).addU32(y).serialize();
            // Calling the smart contract's `getPixelColor` function
            const res = await client.smartContracts().readSmartContract({
              targetAddress: CONTRACT_ADDRESS,
              targetFunction: "getPixelColor",
              parameter: args,
              maxGas: BigInt(2100000),
            });
            // Decoding the color from the smart contract response
            const color = bytesToStr(res.returnValue);
            // Updating the color of the corresponding pixel
            newPixels[x * 10 + y] = `#${color}`;
          } catch (error) {
            console.error(error);
          }
        }
      }
      setPixels(newPixels); // Updating the state with the new pixel colors
    };

    fetchCanvasColors();
  }, [client]); // This effect depends on the client state

  return (
    <div className="App">
      <h1>Canvas Colors</h1>
      <div className="canvas">
        {/* Rendering the pixels as div elements with background colors */}
        {pixels.map((color, index) => (
          <div key={index} className="pixel" style={{ backgroundColor: color }}></div>
        ))}
      </div>
    </div>
  );
}

export default App;
