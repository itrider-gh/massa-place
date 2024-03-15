import "./App.css";
import "@massalabs/react-ui-kit/src/global.css";
import { useEffect, useState } from "react";
import { providers } from "@massalabs/wallet-provider";
import {
  ClientFactory,
  Args,
  Client,
  bytesToStr,
} from "@massalabs/massa-web3";

const CONTRACT_ADDRESS = "AS1YUHspyGBviPBqhnYrXiAWo7m26H5gUBeZxArP8a8wZdMfAJxT";

function App() {
  const [client, setWeb3client] = useState<Client | null>(null);
  const [pixels, setPixels] = useState<Array<string>>(Array(100).fill("#FFFFFF"));

  useEffect(() => {
    const initClientWithBearby = async () => {
      const bearbyProvider = (await providers(true)).find(p => p.name() === "BEARBY");
      if (!bearbyProvider) {
        console.error("Bearby provider not found");
        return;
      }
      const accounts = await bearbyProvider.accounts();
      if (accounts.length === 0) {
        console.error("No accounts found with Bearby provider");
        return;
      }
      const client = await ClientFactory.fromWalletProvider(bearbyProvider, accounts[0], false);
      setWeb3client(client);
    };

    initClientWithBearby().catch(console.error);
  }, []);

  useEffect(() => {
    const fetchCanvasColors = async () => {
      if (!client) return;
      
      try {
        const res = await client.smartContracts().readSmartContract({
          targetAddress: CONTRACT_ADDRESS,
          targetFunction: "getAllPixelColors",
          parameter: new Args().serialize(),
          maxGas: BigInt(3980167295),
        });
        const fullStr = bytesToStr(res.returnValue);
        const gasDelimiterIndex = fullStr.lastIndexOf('|'); // Trouver le délimiteur de gas
        const colorsStr = fullStr.substring(0, gasDelimiterIndex); // Extraire la partie des couleurs
        const remainingGasStr = fullStr.substring(gasDelimiterIndex + 1); // Extraire la valeur de gas restant
        const colorsArray = colorsStr.split(';').filter(c => c);
        
        console.log(`Remaining gas: ${remainingGasStr}`); // Afficher le gas restant pour débogage
  
        if (colorsArray.length === 100) {
          setPixels(colorsArray.map(color => `#${color}`));
        }
      } catch (error) {
        console.error(error);
      }
    };
  
    fetchCanvasColors();
  }, [client]);
  
  

  return (
    <div className="App">
      <h1>Canvas Colors</h1>
      <div className="canvas">
        {pixels.map((color, index) => (
          <div key={index} className="pixel" style={{ backgroundColor: color }}></div>
        ))}
      </div>
    </div>
  );
}

export default App;
