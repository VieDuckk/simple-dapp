import {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";

type SelectedAccountByWallet = Record<string, string | null>;

interface WalletProviderContext {
  wallets: Record<string, EIP6963ProviderDetail>;
  selectedWallet: EIP6963ProviderDetail | null;
  selectedAccount: string | null;
  errorMessage: string | null;
  connectWallet: (walletUuid: string) => Promise<void>;
  disconnectWallet: () => void;
  clearError: () => void;
  getBalance: (account: string) => Promise<string>;
  transferNativeToken: (toAddress: string, amount: string) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
}

declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export const WalletProviderContext = createContext<WalletProviderContext>({
  wallets: {},
  selectedWallet: null,
  selectedAccount: null,
  errorMessage: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  clearError: () => {},
  getBalance: async () => "0",
  transferNativeToken: async () => "",
  signMessage: async () => "",
});

export const WalletProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [wallets, setWallets] = useState<Record<string, EIP6963ProviderDetail>>(
    {}
  );
  const [selectedWalletRdns, setSelectedWalletRdns] = useState<string | null>(
    null
  );
  const [selectedAccountByWalletRdns, setSelectedAccountByWalletRdns] =
    useState<SelectedAccountByWallet>({});

  const [errorMessage, setErrorMessage] = useState("");
  const clearError = () => setErrorMessage("");
  const setError = (error: string) => setErrorMessage(error);

  useEffect(() => {
    const savedSelectedWalletRdns = localStorage.getItem("selectedWalletRdns");
    const savedSelectedAccountByWalletRdns = localStorage.getItem(
      "selectedAccountByWalletRdns"
    );

    if (savedSelectedAccountByWalletRdns) {
      setSelectedAccountByWalletRdns(
        JSON.parse(savedSelectedAccountByWalletRdns)
      );
    }

    function onAnnouncement(event: EIP6963AnnounceProviderEvent) {
      setWallets((currentWallets) => ({
        ...currentWallets,
        [event.detail.info.rdns]: event.detail,
      }));

      if (
        savedSelectedWalletRdns &&
        event.detail.info.rdns === savedSelectedWalletRdns
      ) {
        setSelectedWalletRdns(savedSelectedWalletRdns);
      }
    }

    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    return () =>
      window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, []);

  const connectWallet = useCallback(
    async (walletRdns: string) => {
      try {
        const wallet = wallets[walletRdns];
        const accounts = (await wallet.provider.request({
          method: "eth_requestAccounts",
        })) as string[];

        if (accounts?.[0]) {
          setSelectedWalletRdns(wallet.info.rdns);
          setSelectedAccountByWalletRdns((currentAccounts) => ({
            ...currentAccounts,
            [wallet.info.rdns]: accounts[0],
          }));

          localStorage.setItem("selectedWalletRdns", wallet.info.rdns);
          localStorage.setItem(
            "selectedAccountByWalletRdns",
            JSON.stringify({
              ...selectedAccountByWalletRdns,
              [wallet.info.rdns]: accounts[0],
            })
          );
        }
      } catch (error) {
        console.error("Failed to connect to provider:", error);
        const walletError: WalletError = error as WalletError;
        setError(
          `Code: ${walletError.code} \nError Message: ${walletError.message}`
        );
      }
    },
    [wallets, selectedAccountByWalletRdns]
  );

  const disconnectWallet = useCallback(async () => {
    if (selectedWalletRdns) {
      setSelectedAccountByWalletRdns((currentAccounts) => ({
        ...currentAccounts,
        [selectedWalletRdns]: null,
      }));

      const wallet = wallets[selectedWalletRdns];
      setSelectedWalletRdns(null);
      localStorage.removeItem("selectedWalletRdns");

      try {
        await wallet.provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch (error) {
        console.error("Failed to revoke permissions:", error);
      }
    }
  }, [selectedWalletRdns, wallets]);
  //   const ensureSepoliaNetwork = useCallback(async () => {
  //     if (!selectedWalletRdns || !wallets[selectedWalletRdns]) {
  //       setErrorMessage("No wallet selected");
  //       return false;
  //     }

  //     const wallet = wallets[selectedWalletRdns];
  //     try {
  //       // Lấy chain ID hiện tại
  //       const chainId = (await wallet.provider.request({
  //         method: "eth_chainId",
  //       })) as string;

  //       const sepoliaChainId = "0xaa36a7"; // Chain ID của Sepolia (11155111 trong hex)
  //       if (chainId !== sepoliaChainId) {
  //         // Yêu cầu chuyển sang Sepolia
  //         await wallet.provider.request({
  //           method: "wallet_switchEthereumChain",
  //           params: [{ chainId: sepoliaChainId }],
  //         });
  //       }
  //       return true;
  //     } catch (error) {
  //       console.error("Failed to switch to Sepolia:", error);
  //       setErrorMessage(
  //         "Please switch to Sepolia Testnet manually in your wallet."
  //       );
  //       return false;
  //     }
  //   }, [wallets, selectedWalletRdns]);
  const getBalance = useCallback(
    async (account: string): Promise<string> => {
      if (!selectedWalletRdns || !wallets[selectedWalletRdns] || !account) {
        setErrorMessage("No wallet or account selected");
        return "0";
      }

      try {
        const wallet = wallets[selectedWalletRdns];

        // Lấy chain ID hiện tại
        const chainId = (await wallet.provider.request({
          method: "eth_chainId",
        })) as string;

        const sepoliaChainId = "0xaa36a7"; // Chain ID của Sepolia (11155111 trong hex)
        if (chainId !== sepoliaChainId) {
          setErrorMessage("Please switch to Sepolia Testnet in your wallet.");
          return "0";
        }

        const balanceWei = await wallet.provider.request({
          method: "eth_getBalance",
          params: [account, "latest"],
        });

        const balanceEther = (
          parseInt(balanceWei as string, 16) / 1e18
        ).toFixed(4);
        return balanceEther;
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setErrorMessage(`Error fetching balance: ${(error as Error).message}`);
        return "0";
      }
    },
    [wallets, selectedWalletRdns]
  );
  const transferNativeToken = useCallback(
    async (toAddress: string, amount: string): Promise<string> => {
      if (!selectedWalletRdns || !wallets[selectedWalletRdns]) {
        setErrorMessage("No wallet selected");
        return "0x";
      }

      try {
        const wallet = wallets[selectedWalletRdns];
        const tx = {
          from: selectedAccountByWalletRdns[selectedWalletRdns],
          to: toAddress,
          value: `0x${(parseFloat(amount) * 1e18).toString(16)}`,
        };

        const txHash = await wallet.provider.request({
          method: "eth_sendTransaction",
          params: [tx],
        });
        return txHash as string;
      } catch (error) {
        console.error("Failed to transfer native token:", error);
        setErrorMessage("Error transferring native token");
        throw error;
      }
    },
    [wallets, selectedWalletRdns, selectedAccountByWalletRdns]
  );
  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!selectedWalletRdns || !wallets[selectedWalletRdns]) {
        setErrorMessage("No wallet selected");
        return "";
      }

      try {
        const wallet = wallets[selectedWalletRdns];
        const signature = await wallet.provider.request({
          method: "personal_sign",
          params: [message, selectedAccountByWalletRdns[selectedWalletRdns]],
        });
        return signature as string;
      } catch (error) {
        console.error("Failed to sign message:", error);
        setErrorMessage("Error signing message");
        throw error;
      }
    },
    [wallets, selectedWalletRdns, selectedAccountByWalletRdns]
  );

  const contextValue: WalletProviderContext = {
    wallets,
    selectedWallet:
      selectedWalletRdns === null ? null : wallets[selectedWalletRdns],
    selectedAccount:
      selectedWalletRdns === null
        ? null
        : selectedAccountByWalletRdns[selectedWalletRdns],
    errorMessage,
    connectWallet,
    disconnectWallet,
    clearError,
    getBalance,
    transferNativeToken,
    signMessage,
  };

  return (
    <WalletProviderContext.Provider value={contextValue}>
      {children}
    </WalletProviderContext.Provider>
  );
};
