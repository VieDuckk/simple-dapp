import "./App.css";

import { WalletList } from "./components/WalletList";
import { SelectedWallet } from "./components/SelectedWallet";
import { WalletError } from "./components/WalletError";
import { WalletProvider } from "./hooks/WalletProvider";

function App() {
  return (
    <WalletProvider>
      <WalletList />
      <hr />
      <SelectedWallet />
      <WalletError />
    </WalletProvider>
  );
}

export default App;
