import { useState } from 'react';
import './App.css';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface SolanaData {
  type: string;
  id: string;
  accountAddress: string;
  txHash: string;
}

interface SolanaTransaction {
  description: string;
  signature: string;
  timestamp: number;
  nativeTransfers: [
    {
      amount: number;
    }
  ];
}

function App() {
  const [solanaData, setSolanaData] = useState<SolanaData | null>(null);
  const [solanaDataType, setSolanaDataType] = useState<string>('');
  const [solanaAddress, setSolanaAddress] = useState<string>('');
  const [solanaTxHash, setSolanaTxHash] = useState<string>('');
  const [transactions, setTransactions] = useState<SolanaTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>('');
  const [inputValue, setInputValue] = useState('');

  const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setAiSummary('');

    try {
      const data = await fetchHeliusData(inputValue);
      const summary = await fetchAISummary(data);
      setSolanaData(data);
      setTransactions(data);
      setAiSummary(summary);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
      setInputValue('');
    }
  };

  async function fetchAccountTransactions(accountAddress: string) {
    const cacheKey = `transactions_${accountAddress}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_BASE_URL
        }/addresses/${accountAddress}/transactions?api-key=${
          import.meta.env.VITE_API_KEY
        }&limit=10`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      localStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    } catch (error) {
      console.error(JSON.stringify(error));
      setSolanaAddress('');
      setSolanaDataType('');
      return [];
    }
  }

  async function fetchTransactionDetails(transactionSignature: Array<string>) {
    const cacheKey = `transaction_${transactionSignature}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/transactions?api-key=${
          import.meta.env.VITE_API_KEY
        }`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ transactions: transactionSignature }),
        }
      );
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      localStorage.setItem(cacheKey, JSON.stringify(data));

      return data;
    } catch (error) {
      console.error(JSON.stringify(error));
      setSolanaTxHash('');
      setSolanaDataType('');
      return [];
    }
  }

  async function fetchHeliusData(identifier: string) {
    let data;
    setIsLoading(true);
    if (identifier.length <= 44) {
      data = await fetchAccountTransactions(identifier);
      setSolanaData(data[0]);
      setSolanaDataType('accountAddress');
      setSolanaAddress(identifier);
      setTransactions(data);
      setIsLoading(false);
      return data;
    } else if (identifier.length > 44) {
      const arr = [];
      arr.push(identifier);
      data = await fetchTransactionDetails(arr);
      setSolanaData(data[0]);
      setSolanaDataType('txHash');
      setSolanaTxHash(identifier);
      setTransactions(data);
      setIsLoading(false);
      return data;
    } else {
      throw new Error('Invalid identifier provided.');
    }
  }

  async function fetchAISummary(data: object) {
    try {
      const cacheKey = `aisummary_${JSON.stringify(data)}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }
      if (Object.keys(data).length === 0) {
        return 'No summary available as there is no transaction record';
      }
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: `You are a large language model extensively trained in Solana Program's Interface Description Language. I am providing some data in JSON format which represents the data about a given transaction/transactions. Your summary should be a general overview and must not exceed 60 words. You can only exceed the constraint if the data is an array of transactions, in that case, you can output more words but in the given format: <x> tokens transferred from <source_address> to <destination_address> and vice vera (you get the gist). Carefully analyze the provided data and return a concise summary of what's going on in the transaction/transactions. The data is not just an array of placeholder inputs, you should parse the data and provide insights, said data is - ${JSON.stringify(
          data
        )}`,
      });
      const prompt = `Analyze and draw insights`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();
      localStorage.setItem(cacheKey, JSON.stringify(text));
      return text;
    } catch (error) {
      console.error(error);
    }
  }

  const renderData = () => {
    console.log(solanaAddress);
    return (
      <>
        <div>
          <form onSubmit={handleSubmit} className='custom-form'>
            <input
              type='text'
              value={inputValue}
              onChange={handleInputChange}
              className='custom-input'
            />
            <button type='submit' className='custom-button'>
              Submit
            </button>
          </form>
        </div>
        {!isLoading && inputValue === '' && (
          <p>Input a valid solana address or transaction hash</p>
        )}
        {isLoading && inputValue !== '' && <p>Loading...</p>}
        {isLoading && !solanaData && aiSummary === '' && (
          <p>Fetching AI summary ...</p>
        )}
        {!isLoading && !transactions && <p>No data available.</p>}
        {!isLoading && transactions && aiSummary !== '' && (
          <div>
            {solanaData?.accountAddress && (
              <p>
                Address: {solanaData?.accountAddress || 'Address unavailable'}
              </p>
            )}
            {solanaData?.txHash && (
              <p>
                Transaction hash:{' '}
                {solanaData?.txHash || 'Transaction hash unavailable'}
              </p>
            )}
            <br />
            <p>
              <strong>AI Summary:</strong> {aiSummary || 'Summary unavailable'}
            </p>
            {transactions.length > 0 && (
              <p>Here are the transaction details:</p>
            )}

            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              {solanaDataType === 'accountAddress'
                ? transactions.map(
                    (transaction: SolanaTransaction, index: number) => (
                      <li
                        key={index}
                        style={{
                          marginBottom: '10px',
                          border: '1px solid #ccc',
                          padding: '10px',
                          borderRadius: '5px',
                        }}
                      >
                        <p>
                          <strong>Transaction hash:</strong>{' '}
                          {transaction.signature}
                        </p>
                        {/* <p>
                          <strong>Description:</strong>{' '}
                          {transaction.description}
                        </p> */}
                        {transaction.description && (
                          <p>
                            <strong>Description:</strong>{' '}
                            {transaction.description}
                          </p>
                        )}
                        <p>
                          <strong>Date:</strong>{' '}
                          {new Date(
                            transaction.timestamp * 1000
                          ).toLocaleString()}
                        </p>
                      </li>
                    )
                  )
                : solanaDataType === 'txHash' &&
                  transactions
                    .filter(
                      (transaction: SolanaTransaction) =>
                        transaction.signature === solanaTxHash
                    )
                    .map((transaction: SolanaTransaction, index: number) => (
                      <li
                        key={index}
                        style={{
                          marginBottom: '10px',
                          border: '1px solid #ccc',
                          padding: '10px',
                          borderRadius: '5px',
                        }}
                      >
                        <p>
                          <strong>Transaction hash:</strong>{' '}
                          {transaction.signature}
                        </p>
                        <p>
                          <strong>Description:</strong>{' '}
                          {transaction.description}
                        </p>
                        <p>
                          <strong>Date:</strong>{' '}
                          {new Date(
                            transaction.timestamp * 1000
                          ).toLocaleString()}
                        </p>
                      </li>
                    ))}
            </ul>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      <div className='header-container'>
        <span className='mini-text'>
          <h1>Mini</h1>
        </span>{' '}
        <a href='https://talentolympics.fun/' target='_blank'>
          <img
            src='https://explorer.solana.com/_next/static/media/dark-explorer-logo.8d80d8ed.svg'
            className='logo'
            alt='Solana explorer logo'
          />
        </a>
      </div>
      <div className='card'>{renderData()}</div>
      <p className='read-the-docs'>© 2024 Made with ❤️ for Solana</p>
    </>
  );
}

export default App;
