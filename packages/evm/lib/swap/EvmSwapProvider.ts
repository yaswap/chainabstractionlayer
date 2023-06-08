import { HttpClient } from '@yaswap/client';
import { TxStatus, SwapParams, Transaction, BigNumber } from '@yaswap/types';
import { Math, remove0x, ensure0x } from '@yaswap/utils';
import { TxNotFoundError, PendingTxError } from '@yaswap/errors';
import { BaseProvider, Log } from '@ethersproject/providers';
import { ClaimEvent, RefundEvent } from '../typechain/LiqualityHTLC';
import { EvmSwapOptions, ScraperTransaction } from '../types';
import { EvmBaseWalletProvider } from '../wallet/EvmBaseWalletProvider';
import { EvmBaseSwapProvider } from './EvmBaseSwapProvider';
import { caseInsensitiveEqual, numberToHex, normalizeTransactionObject } from '../utils';

export class EvmSwapProvider extends EvmBaseSwapProvider {
    private _httpClient: HttpClient;
    protected walletProvider: EvmBaseWalletProvider<BaseProvider>;

    constructor(swapOptions: EvmSwapOptions, walletProvider?: EvmBaseWalletProvider<BaseProvider>) {
        super(swapOptions, walletProvider);
        this._httpClient = new HttpClient({ baseURL: swapOptions.scraperUrl });
    }

    public normalizeTransactionResponse(tx: any): Transaction<ScraperTransaction> {
        const txRaw: ScraperTransaction = {
          from: tx.from,
          to: tx.to,
          hash: tx.hash,
          secret: tx.secret,
          blockHash: tx.blockHash,
          blockNumber: numberToHex(tx.blockNumber),
          status: tx.status === true ? '0x1' : '0x0',
          input: tx.input,
          contractAddress: tx.contractAddress,
          timestamp: numberToHex(tx.timestamp),
          value: numberToHex(tx.value),
          confirmations: tx.confirmations
        }
        const normalizedTransaction = normalizeTransactionObject(txRaw)
        normalizedTransaction.confirmations = txRaw.confirmations
    
        if (normalizedTransaction._raw.contractAddress) {
          normalizedTransaction._raw.contractAddress = normalizedTransaction._raw.contractAddress.toLowerCase()
        }
    
        if (normalizedTransaction._raw.secret) {
          normalizedTransaction.secret = remove0x(normalizedTransaction._raw.secret)
        }
    
        return normalizedTransaction
    }

    public async ensureFeeInfo(tx: Transaction<ScraperTransaction>) {
        if (!(tx.fee && tx.feePrice)) {
          const { fee, feePrice, _raw } = await this.walletProvider.getChainProvider().getTransactionByHash(tx.hash)
    
          tx._raw.gas = _raw.gas
          tx._raw.gasPrice = _raw.gasPrice
    
          tx.fee = fee
          tx.feePrice = feePrice
        }
    
        return tx
    }

    public async findAddressTransaction(
        address: string,
        predicate: (tx: Transaction<ScraperTransaction>) => boolean,
        fromBlock?: number,
        toBlock?: number,
        limit = 250,
        sort = 'desc'
    ) {
      for (let page = 1; ; page++) {
        const data = await this._httpClient.nodeGet(`/txs/${address}`, {
          limit,
          page,
          sort,
          fromBlock,
          toBlock
        })
  
        const transactions: any[] = data.data.txs
        if (transactions.length === 0) return
  
        const normalizedTransactions = transactions
          .filter((tx) => {
              return tx.status === true
          })
          .map(this.normalizeTransactionResponse)
        const tx = normalizedTransactions.find(predicate)
        if (tx) {
          return this.ensureFeeInfo(tx)
        }
  
        if (transactions.length < limit) return
      }
    }

    async findInitiateSwapTransaction(swapParams: SwapParams): Promise<Transaction<ScraperTransaction>> {
        this.validateSwapParams(swapParams)
        return this.findAddressTransaction(swapParams.refundAddress.toString(), (tx) =>
                                      this.doesTransactionMatchInitiation(swapParams, tx))
    }

    public async findErc20Events(
      erc20ContractAddress: string,
      address: string,
      predicate: (tx: Transaction<ScraperTransaction>) => boolean,
      fromBlock?: number,
      toBlock?: number,
      limit = 250,
      sort = 'desc'
  ) {
    erc20ContractAddress = ensure0x(erc20ContractAddress)
    address = ensure0x(address)
    for (let page = 1; ; page++) {
      const data = await this._httpClient.nodeGet(`/events/erc20Transfer/${erc20ContractAddress}`, {
        address,
        limit,
        page,
        sort,
        fromBlock,
        toBlock
      })

      const transactions: any[] = data.data.txs
      if (transactions.length === 0) return

      const normalizedTransactions = transactions
        .filter((tx) => {
            return tx.status === true
        })
        .map(this.normalizeTransactionResponse)
      const tx = normalizedTransactions.find(predicate)
      if (tx) {
        return this.ensureFeeInfo(tx)
      }

      if (transactions.length < limit) return
    }
  }
    
    async findFundSwapTransaction(swapParams: SwapParams, initiationTxHash: string): Promise<Transaction> {
      this.validateSwapParams(swapParams)

      const initiationTransaction = await this.walletProvider.getChainProvider().getTransactionByHash(initiationTxHash);
      if (!initiationTransaction) throw new TxNotFoundError(`Transaction not found: ${initiationTxHash}`)
      if (initiationTransaction.status === TxStatus.Pending) {
          throw new PendingTxError(`Transaction receipt is not available: ${initiationTxHash}`)
      }
  
      const contractAddress = initiationTransaction.contractAddress
      const erc20TokenContractAddress = swapParams.asset.contractAddress
  
      const tx = await this.findErc20Events(
        erc20TokenContractAddress,
        contractAddress,
        (tx) =>
          caseInsensitiveEqual(remove0x(tx._raw.to), remove0x(contractAddress)) &&
          new BigNumber(tx.value).isEqualTo(swapParams.value)
      )
  
      if (!tx) throw new TxNotFoundError(`Funding transaction is not available: ${initiationTxHash}`)
  
      return tx
    }

    async findClaimSwapTransaction(swapParams: SwapParams, initTxHash: string): Promise<Transaction<ClaimEvent>> {
        const foundTx = await this.findTx<ClaimEvent>(swapParams, initTxHash, 'Claim');
        const secret = foundTx?._raw?.args?.secret;
        if (secret) {
            return { ...foundTx, secret: remove0x(secret) };
        }
    }

    async findRefundSwapTransaction(swapParams: SwapParams, initTxHash: string): Promise<Transaction<RefundEvent>> {
        return this.findTx<RefundEvent>(swapParams, initTxHash, 'Refund');
    }

    private async searchLogs(callback: (from: number, to: number) => Promise<Transaction>, currentBlock: number) {
        // let from = Math.sub(currentBlock, this.swapOptions.numberOfBlocksPerRequest).toString();
        let from = Math.sub(currentBlock, 0).toString();
        let to = currentBlock.toString();

        // while (Math.gte(from, Math.sub(currentBlock, this.swapOptions.totalNumberOfBlocks))) {
        while (Math.gte(from, Math.sub(currentBlock, 0))) {
            const result = await callback(Number(from), Number(to));
            if (result) {
                return result;
            }
            // from = Math.sub(from, this.swapOptions.numberOfBlocksPerRequest).toString();
            // to = Math.sub(to, this.swapOptions.numberOfBlocksPerRequest).toString();
            from = Math.sub(from, 0).toString();
            to = Math.sub(to, 0).toString();
        }
    }

    private async findTx<EventType>(swapParams: SwapParams, initTxHash: string, eventFilter: string): Promise<Transaction<EventType>> {
        const txReceipt = await this.walletProvider.getChainProvider().getTransactionByHash(initTxHash);

        if (txReceipt?.logs) {
            for (const log of txReceipt.logs as Log[]) {
                const initiate = this.tryParseLog(log);

                if (initiate?.args?.id && initiate.args.htlc) {
                    await this.verifyInitiateSwapTransaction(swapParams, { ...txReceipt, _raw: initiate });
                    const currentBlock = await this.walletProvider.getChainProvider().getBlockHeight();
                    return await this.searchLogs(async (from: number, to: number) => {
                        const event = await this.contract.queryFilter(this.contract.filters[eventFilter](initiate.args.id), from, to);
                        if (event.length > 1) {
                            throw Error(`This should never happen. Found more than one ${eventFilter} TX`);
                        } else {
                            if (event[0]) {
                                const tx = await this.walletProvider.getChainProvider().getTransactionByHash(event[0].transactionHash);
                                return { ...tx, _raw: event[0] };
                            }
                        }
                    }, currentBlock);
                }
            }
        }
        return null;
    }
}
