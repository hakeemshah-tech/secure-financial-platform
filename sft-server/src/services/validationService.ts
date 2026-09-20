import mongoose from 'mongoose';

/**
 * Checks if a blockchain transaction hash is unique globally across all relevant collections.
 * @param txHash The transaction hash to check
 * @param excludeIds Optional ID or array of IDs to exclude from the check
 * @returns Promise<boolean> - true if unique, false if already exists
 */
export const isTxHashUnique = async (txHash: string, excludeIds?: string | string[]): Promise<boolean> => {
    if (!txHash) return true;

    // Use mongoose.model to retrieve models and avoid circular dependencies
    // Ensure models are registered to prevent MissingSchemaError
    if (!mongoose.models.Transaction) (await import('../models/Transaction'));
    if (!mongoose.models.Investment) (await import('../models/Investment'));
    if (!mongoose.models.SwapRequest) (await import('../models/SwapRequest'));

    const Transaction = mongoose.model('Transaction');
    const Investment = mongoose.model('Investment');
    const SwapRequest = mongoose.model('SwapRequest');

    // Normalize excludeIds to an array
    const exclusions = excludeIds ? (Array.isArray(excludeIds) ? excludeIds : [excludeIds]) : [];

    // 1. Check Transaction Log
    const transactionExists = await Transaction.findOne({
        txHash,
        _id: { $nin: exclusions }
    });
    if (transactionExists) return false;

    // 2. Check Investment (txHash or sftTxHash)
    const investmentExists = await Investment.findOne({
        $or: [
            { txHash, _id: { $nin: exclusions } },
            { sftTxHash: txHash, _id: { $nin: exclusions } }
        ]
    } as any);
    if (investmentExists) return false;

    // 3. Check SwapRequest (userTxHash or adminTxHash)
    const swapExists = await SwapRequest.findOne({
        $or: [
            { userTxHash: txHash, _id: { $nin: exclusions } },
            { adminTxHash: txHash, _id: { $nin: exclusions } }
        ]
    } as any);
    if (swapExists) return false;

    return true;
};
