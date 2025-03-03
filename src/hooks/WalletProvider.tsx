/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import { BigNumber, ethers } from "ethers";
const calculateGasMargin = (value: BigNumber): BigNumber => {
  return value.mul(11).div(10); 
};
type SelectedAccountByWallet = Record<string, string | null>;
async function isContract(provider: ethers.providers.Provider, address: string): Promise<boolean> {
  try {
    const code = await provider.getCode(address);
    return code !== "0x" && code !== "0x0";
  } catch (error) {
    console.error("Lỗi khi kiểm tra hợp đồng:", error);
    return false;
  }
}
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
  approveERC20: (tokenAddress: string, spender: string, amount: string) => Promise<string>;
  transferERC20: (tokenAddress: string, toAddress: string, amount: string) => Promise<string>;
}
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function safeTransfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) returns (uint256)"
];
declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent;
  }
}

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
  approveERC20: async () => "",
  transferERC20: async () => ""
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = useCallback(() => setErrorMessage(null), []);
  const setError = useCallback((error: string) => setErrorMessage(error), []);

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

  useEffect(() => {
    let ethersProvider: ethers.providers.Web3Provider | null = null;

    const handleAccountsChanged = (accounts: string[]) => {
      if (selectedWalletRdns && accounts.length > 0) {
        setSelectedAccountByWalletRdns((currentAccounts) => {
          const newAccounts = {
            ...currentAccounts,
            [selectedWalletRdns]: accounts[0],
          };
          localStorage.setItem(
            "selectedAccountByWalletRdns",
            JSON.stringify(newAccounts)
          );
          return newAccounts;
        });
      } else if (accounts.length === 0) {
        disconnectWallet();
      }
    };

    const handleChainChanged = (chainId: string) => {
      const sepoliaChainId = "0xaa36a7";
      if (chainId !== sepoliaChainId) {
        setErrorMessage("Please switch back to Sepolia Testnet.");
      } else {
        clearError();
      }
    };

    if (selectedWalletRdns && wallets[selectedWalletRdns]) {
      ethersProvider = new ethers.providers.Web3Provider(
        wallets[selectedWalletRdns].provider
      );
      ethersProvider.on("accountsChanged", handleAccountsChanged);
      ethersProvider.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (ethersProvider) {
        ethersProvider.removeListener("accountsChanged", handleAccountsChanged);
        ethersProvider.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, [selectedWalletRdns, wallets]);

  const disconnectWallet = useCallback(async () => {
    if (selectedWalletRdns) {
      setSelectedAccountByWalletRdns((currentAccounts) => ({
        ...currentAccounts,
        [selectedWalletRdns]: null,
      }));
      setSelectedWalletRdns(null);
      localStorage.removeItem("selectedWalletRdns");

      const wallet = wallets[selectedWalletRdns];
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
        const walletError = error as any;
        setError(
          `Code: ${walletError.code} \nError Message: ${walletError.message}`
        );
      }
    },
    [wallets, selectedAccountByWalletRdns]
  );

  const getBalance = useCallback(
    async (account: string): Promise<string> => {
      if (!selectedWalletRdns || !wallets[selectedWalletRdns] || !account) {
        setErrorMessage("No wallet or account selected");
        return "0";
      }

      try {
        const wallet = wallets[selectedWalletRdns];
        const chainId = (await wallet.provider.request({
          method: "eth_chainId",
        })) as string;

        const sepoliaChainId = "0xaa36a7";
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
 
  const approveERC20 = useCallback(
    async (tokenAddress: string, spender: string, amount: string): Promise<string> => {
      if (!selectedWalletRdns || !wallets[selectedWalletRdns]) {
        setErrorMessage("Không có ví được chọn");
        throw new Error("Không có ví được chọn");
      }
  
      try {
        const wallet = wallets[selectedWalletRdns];
        const provider = new ethers.providers.Web3Provider(wallet.provider);
        const signer = provider.getSigner();
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        
        // Kiểm tra xem tokenAddress có phải là hợp đồng không
        if (!(await isContract(provider, tokenAddress))) {
          setErrorMessage("Địa chỉ token không phải là hợp đồng");
          throw new Error("Địa chỉ token không phải là hợp đồng");
        }
  
        // Chuyển amount sang wei
        const amountWei = ethers.utils.parseUnits(amount, 18);
        const owner = selectedAccountByWalletRdns[selectedWalletRdns]!;
        
        // Lấy thông tin gas
        const gasPrice = await provider.getGasPrice();
        const ethBalance = BigNumber.from(await provider.getBalance(owner));
        
        // Ước tính gas cho giao dịch approve
        let gasEstimate: BigNumber;
        try {
          gasEstimate = await contract.estimateGas.approve(spender, amountWei);
        } catch (error) {
          console.error("Failed to estimate gas for approve:", error);
          setErrorMessage("Không thể ước tính gas cho approve");
          throw error;
        }
  
        // Tính toán gas margin
        const gasLimit = calculateGasMargin(gasEstimate);
        const gasCost = gasLimit.mul(gasPrice);
  
        // Kiểm tra số dư ETH để trả phí gas
        if (ethBalance.lt(gasCost)) {
          setErrorMessage(
            `Không đủ ETH để trả phí gas: cần ${ethers.utils.formatEther(gasCost)} ETH`
          );
          throw new Error("Không đủ ETH để trả phí gas");
        }
  
        // Thực hiện approve với amount truyền vào
        const tx = await contract.approve(spender, amountWei, {
          gasLimit: gasLimit,
        });
        
        await tx.wait();
        return tx.hash;
      } catch (error) {
        console.error("Không thể phê duyệt token ERC20:", error);
        setErrorMessage(`Không thể phê duyệt token ERC20: ${(error as Error).message}`);
        throw error;
      }
    },
    [wallets, selectedWalletRdns, selectedAccountByWalletRdns]
  );
  
  const transferERC20 = useCallback(
    async (tokenAddress: string, toAddress: string, amount: string): Promise<string> => {
      if (!selectedWalletRdns || !wallets[selectedWalletRdns]) {
        setErrorMessage("Không có ví được chọn");
        throw new Error("Không có ví được chọn");
      }
  
      try {
        const wallet = wallets[selectedWalletRdns];
        const provider = new ethers.providers.Web3Provider(wallet.provider);
        const signer = provider.getSigner();
        const contractRead = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const contractWrite = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        
        if (!(await isContract(provider, tokenAddress))) {
          setErrorMessage("This is not a contract address");                                                                                                         
          throw new Error("This is not a contract address");
        }
  
        const amountWei = ethers.utils.parseUnits(amount, 18);
        const owner = selectedAccountByWalletRdns[selectedWalletRdns]!;
        
        let allowanceRaw: string;
        try {
          allowanceRaw = await contractRead.callStatic.allowance(owner, toAddress);
        } catch (error) {
          throw new Error("Cannot take allowance from contract");
        }
        const currentAllowance = BigNumber.from(allowanceRaw);
        
        if (currentAllowance.lt(amountWei)) {
          await approveERC20(tokenAddress, toAddress, amount);
          
          let newAllowanceRaw: string;
          try {
            newAllowanceRaw = await contractRead.callStatic.allowance(owner, toAddress);
          } catch (error) {
            throw new Error("Cannot confirm allowance after approved");
          }
          const newAllowance = BigNumber.from(newAllowanceRaw);
          if (newAllowance.lt(amountWei)) {
            throw new Error("Not enough allowance");
          }
        }
        
        // Kiểm tra số dư token trước
        let tokenBalanceRaw: string;
        try {
          tokenBalanceRaw = await contractRead.callStatic.balanceOf(owner);
        } catch (error) {
          throw new Error("Cannot take balance from contract");
        }
        const tokenBalance = BigNumber.from(tokenBalanceRaw);
        if (tokenBalance.lt(amountWei)) {
          setErrorMessage(
            `Not enough LINK");: need ${ethers.utils.formatUnits(amountWei, 18)} LINK but just have ${ethers.utils.formatUnits(tokenBalance, 18)} LINK`
          );
          throw new Error("Not enough LINK");
        }
  
        // Tính phí gas
        const gasPrice = await provider.getGasPrice();
        let gasEstimate: BigNumber;
        try {
          gasEstimate = await contractWrite.estimateGas.transfer(toAddress, amountWei);
        } catch (error) {
          console.error("Failed to estimate gas:", error);
          setErrorMessage("Failed to estimate gas");
          throw error;
        }
        const gasCost = gasEstimate.mul(gasPrice);
        const gasCostEth = ethers.utils.formatEther(gasCost);
        
        const ethBalance = BigNumber.from(await provider.getBalance(owner));
        if (ethBalance.lt(gasCost)) {
          setErrorMessage(
            `Not enough gas: cần ${gasCostEth} ETH but just have ${ethers.utils.formatEther(ethBalance)} ETH`
          );
          throw new Error("Not enough gas");
        }
  
        // Thực hiện giao dịch
        const tx = await contractWrite.transfer(toAddress, amountWei, {
          gasLimit: calculateGasMargin(gasEstimate),
        });
        console.log(`Transfering ${amount} LINK with gas about ${gasCostEth} ETH`);
        
        await tx.wait();
        return tx.hash;
      } catch (error) {
        console.error("Cannot transfer token ERC20:", error);
        console.error("Detail error:", JSON.stringify(error));
        setErrorMessage(`Cannot transfer token ERC20: ${(error as Error).message}`);
        throw error;
      }
    },
    [wallets, selectedWalletRdns, selectedAccountByWalletRdns, approveERC20]
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
    approveERC20,
    transferERC20
  };

  return (
    <WalletProviderContext.Provider value={contextValue}>
      {children}
    </WalletProviderContext.Provider>
  );
};
