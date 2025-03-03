import { useWalletProvider } from "../hooks/useWalletProvider";
import styles from "./SelectedWallet.module.css";
import { useState, useEffect } from "react";

export const SelectedWallet = () => {
  const {
    selectedWallet,
    selectedAccount,
    disconnectWallet,
    getBalance,
    transferNativeToken,
    signMessage,
    transferERC20,
    approveERC20, // Thêm hàm approveERC20
    errorMessage,
    clearError,
  } = useWalletProvider();
  const [balance, setBalance] = useState<string>("0");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [message, setMessage] = useState("");
  const [txType, setTxType] = useState<"native" | "erc20" | "sign" | "approve" | null>(null); // Thêm "approve"
  const [txResult, setTxResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (selectedAccount) {
        try {
          const accountBalance = await getBalance(selectedAccount);
          setBalance(accountBalance);
        } catch (error) {
          console.error("Failed to fetch balance:", error);
          setBalance("Error");
        }
      } else {
        setBalance("0");
      }
    };
    fetchBalance();
  }, [selectedAccount, getBalance]);

  const handleTransaction = async () => {
    try {
      let result: string;
      if (txType === "native") {
        result = await transferNativeToken(toAddress, amount);
      } else if (txType === "erc20") {
        result = await transferERC20(tokenAddress, toAddress, amount);
      } else if (txType === "sign") {
        result = await signMessage(message);
      } else if (txType === "approve") {
        result = await approveERC20(tokenAddress, toAddress, amount);
      } else {
        return;
      }
      setTxResult(result);
    } catch (error) {
      setTxResult(`Error: ${(error as Error).message}`);
    }
  };

  const openModal = (type: "native" | "erc20" | "sign" | "approve") => {
    setTxType(type);
    setIsModalOpen(true);
    setTxResult(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setToAddress("");
    setAmount("");
    setTokenAddress("");
    setMessage("");
    setTxType(null);
  };

  return (
    <>
      <h2 className={styles.userAccount}>
        {selectedAccount ? "" : "No "}Wallet selected
      </h2>
      {selectedAccount && (
        <>
          <div className={styles.selectedWallet}>
            {selectedWallet && (
              <img
                src={selectedWallet.info.icon}
                alt={selectedWallet.info.name}
              />
            )}
            <div>{selectedWallet?.info?.name}</div>
            <div>({selectedAccount})</div>
            <div>
              <strong>uuid:</strong> {selectedWallet?.info.uuid}
            </div>
            <div>
              <strong>rdns:</strong> {selectedWallet?.info.rdns}
            </div>
            <div>
              <strong>Balance:</strong> {balance} Sepolia ETH
            </div>
          </div>
          {errorMessage && (
            <div className={styles.errorMessage}>
              {errorMessage}
              <button onClick={clearError}>Close error</button>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              marginTop: "1rem",
            }}
          >
            <button onClick={disconnectWallet} style={{ margin: "auto" }}>
              Disconnect
            </button>
            <button
              onClick={() => openModal("native")}
              style={{ margin: "auto" }}
            >
              Transfer Native Token
            </button>
            <button
              onClick={() => openModal("erc20")}
              style={{ margin: "auto" }}
            >
              Transfer ERC20 Token
            </button>
            <button
              onClick={() => openModal("approve")} // Thêm nút Approve
              style={{ margin: "auto" }}
            >
              Approve ERC20 Token
            </button>
            <button
              onClick={() => openModal("sign")}
              style={{ margin: "auto" }}
            >
              Sign message
            </button>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>
              {txType === "native"
                ? "Transfer Native Token"
                : txType === "erc20"
                ? "Transfer ERC20 Token"
                : txType === "approve"
                ? "Approve ERC20 Token"
                : "Sign message"}
            </h3>
            {txType === "native" && (
              <>
                <label>
                  To address:
                  <input
                    type="text"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                  />
                </label>
                <label>
                  Amount (Sepolia ETH):
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </>
            )}
            {(txType === "erc20" || txType === "approve") && (
              <>
                <label>
                  Token address:
                  <input
                    type="text"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                  />
                </label>
                <label>
                  To:
                  <input
                    type="text"
                    value={toAddress}
                    onChange={(e) => setToAddress(e.target.value)}
                  />
                </label>
                <label>
                  Amount:
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </>
            )}
            {txType === "sign" && (
              <label>
                Message:
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>
            )}
            <button onClick={handleTransaction}>
              {txType === "approve" ? "Approve" : "Transfer"}
            </button>
            <button onClick={closeModal}>Close</button>
            {txResult && (
              <p>
                Transaction:{" "}
                <div style={{ width: "100%", wordBreak: "break-all" }}>
                  {txResult}
                </div>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};