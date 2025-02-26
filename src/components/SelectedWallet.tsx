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
    errorMessage, // Thêm errorMessage từ context
    clearError, // Thêm clearError để xóa thông báo khi cần
  } = useWalletProvider();
  const [balance, setBalance] = useState<string>("0");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [txType, setTxType] = useState<"native" | "sign" | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      if (selectedAccount) {
        try {
          const accountBalance = await getBalance(selectedAccount);
          setBalance(accountBalance);
        } catch (error) {
          console.error("Error fetching balance:", error);
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
      } else if (txType === "sign") {
        result = await signMessage(message);
      } else {
        return;
      }
      setTxResult(result);
    } catch (error) {
      setTxResult(error as string);
    }
  };

  const openModal = (type: "native" | "sign") => {
    setTxType(type);
    setIsModalOpen(true);
    setTxResult(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setToAddress("");
    setAmount("");
    setMessage("");
    setTxType(null);
  };

  return (
    <>
      <h2 className={styles.userAccount}>
        {selectedAccount ? "" : "No "}Wallet Selected
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
              <strong>balance:</strong> {balance} Sepolia ETH
            </div>
          </div>
          {errorMessage && (
            <div className={styles.errorMessage}>
              {errorMessage}
              <button onClick={clearError}>Dismiss</button>
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
              Disconnect Wallet
            </button>
            <button
              onClick={() => openModal("native")}
              style={{ margin: "auto" }}
            >
              Transfer Native Token
            </button>
            <button
              onClick={() => openModal("sign")}
              style={{ margin: "auto" }}
            >
              Sign Message
            </button>
          </div>
        </>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>
              {txType === "native" ? "Transfer Native Token" : "Sign Message"}
            </h3>
            {txType === "native" && (
              <>
                <label>
                  To Address:
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
            <button onClick={handleTransaction}>Execute</button>
            <button onClick={closeModal}>Close</button>
            {txResult && (
              <p>
                Result:{" "}
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
