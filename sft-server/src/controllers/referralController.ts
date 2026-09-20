import { Request, Response } from 'express';
import User, { IUser } from '../models/User';
import mongoose from 'mongoose';
import { notifyUser } from './notificationController';
// import { checkAndCapIncome } from '../services/incomeService';

// Grammar: Helper functions should be defined before use to avoid issues, or handled cleanly.

// Helper: Update Upline Counts (Called when a new user is placed)
const updateUplineCounts = async (userId: string) => {
    try {
        const User = require('../models/User').default;
        const user = await User.findById(userId);
        if (!user || !user.placementParent) return;

        let childNode = user;
        let parentNode = await User.findById(user.placementParent);
        // let depth = 1; // Depth tracking if needed

        while (parentNode) {
            // Determine side
            let isLeft = false;
            if (parentNode.leftChild && parentNode.leftChild.toString() === childNode._id.toString()) {
                isLeft = true;
            } else if (parentNode.rightChild && parentNode.rightChild.toString() === childNode._id.toString()) {
                isLeft = false;
            } else {
                break; // Should not happen
            }

            // Update Counts Atomically
            const updateField = isLeft ? 'leftCount' : 'rightCount';

            // Use findByIdAndUpdate for atomic increment
            parentNode = await User.findByIdAndUpdate(
                parentNode._id,
                { $inc: { [updateField]: 1 } },
                { new: true } // Return updated doc to continue traversal
            );

            if (!parentNode) break;

            // Move Up
            childNode = parentNode;
            if (parentNode.placementParent) {
                parentNode = await User.findById(parentNode.placementParent);
            } else {
                parentNode = null;
            }
            // depth++;
        }
    } catch (error) {
        console.error("Error updating upline counts:", error);
    }
};

// Helper: Update Active Upline Counts (Called when a user becomes active)
export const updateActiveUplineCounts = async (userId: string) => {
    try {
        const User = require('../models/User').default;
        const user = await User.findById(userId);
        if (!user || !user.placementParent) return;

        console.log(`Checking activation for user ${user.email}`);

        // Only update if not already counted (logic depends on caller ensuring this is only called once per activation, or we check a flag)
        // Ideally, this is called when isActive flips from false to true.

        let childNode = user;
        let parentNode = await User.findById(user.placementParent);

        while (parentNode) {
            let isLeft = false;
            if (parentNode.leftChild && parentNode.leftChild.toString() === childNode._id.toString()) {
                isLeft = true;
            } else if (parentNode.rightChild && parentNode.rightChild.toString() === childNode._id.toString()) {
                isLeft = false;
            } else {
                break;
            }

            const updateField = isLeft ? 'leftActiveCount' : 'rightActiveCount';

            // Atomic Increment
            parentNode = await User.findByIdAndUpdate(
                parentNode._id,
                { $inc: { [updateField]: 1 } },
                { new: true }
            );

            if (!parentNode) break;

            childNode = parentNode;
            if (parentNode.placementParent) {
                parentNode = await User.findById(parentNode.placementParent);
            } else {
                parentNode = null;
            }
        }
        console.log(`Active counts updated for upline of ${user.email}`);
    } catch (error) {
        console.error("Error updating active upline counts:", error);
    }
};

// Helper: Distribute Matching Income (Global Binary Match)
const distributeMatchingIncomeForUser = async (user: any, planId: any) => {
    try {
        const IncomeSettings = require('../models/IncomeSettings').default;
        const Transaction = require('../models/Transaction').default;

        const settings = await IncomeSettings.findOne();
        if (!settings || !settings.matchingIncome) {
            return;
        }

        const percentage = settings.matchingIncome;

        // Global Volume Check
        const left = user.leftVolume || 0;
        const right = user.rightVolume || 0;
        const totalMatched = user.totalMatched || 0;

        // Current Possible Match is Min(Left, Right)
        const currentMatchable = Math.min(left, right);

        // New Volume to Match
        const newMatchable = currentMatchable - totalMatched;

        if (newMatchable > 0) {
            let income = newMatchable * (percentage / 100);

            let status = 'COMPLETED';
            if (!user.isActive) {
                status = 'SKIPPED';
                console.log(`   ⚠️ User ${user.email} is INACTIVE. Income SKIPPED.`);
            }

            // [NEW] Check Income Cap - REMOVED (Cap Withdrawal only)
            const isCapped = false;
            if (status === 'COMPLETED') {
                // const capResult = await checkAndCapIncome(user._id.toString(), income);
                // if (capResult.amount < income) {
                //     console.log(`   ⚠️ Income Capped for ${user.email}. Potential: ${income}, Paid: ${capResult.amount}`);
                // }
                // income = capResult.amount; 
                // isCapped = capResult.isCapped;
            }

            console.log(`   💰 Global Match! User: ${user.email}`);
            console.log(`      Left: ${left}, Right: ${right}, Matchable: ${currentMatchable}`);
            console.log(`      Prev Matched: ${totalMatched}, New: ${newMatchable}`);
            console.log(`      Income: ${income} SFT (${status})`);

            // Update Total Matched Volume (Effectively "burning" the matched pairs)
            user.totalMatched += newMatchable;

            if (status === 'COMPLETED') {
                user.totalMatchingIncome += income;
                user.totalEarnedIncome = (user.totalEarnedIncome || 0) + income; // Track Total Earned
            }

            await user.save();

            // Create Transaction
            if (income > 0 || status === 'SKIPPED') { // Only create if > 0 or skipped (tracking)
                await Transaction.create({
                    user: user._id,
                    plan: planId,
                    type: 'MATCHING_INCOME',
                    amountSFT: income,
                    amountSFTAllocated: income,
                    status: status, // COMPLETED or SKIPPED
                    txHash: undefined
                });

                if (status === 'COMPLETED') {
                    await notifyUser(user._id.toString(), 'Matching Income', `You received ${income} SFT Matching Income.${isCapped ? ' (Capped)' : ''}`);
                }
            }

            if (status === 'COMPLETED') {
                await notifyUser(user._id.toString(), 'Matching Income', `You received ${income} SFT Matching Income.`);
            }
        }

    } catch (error) {
        console.error(`Error distributing matching income for user ${user.email}:`, error);
    }
}

// Helper: Place User in Binary Tree (BFS - Level Order)
export const placeUserInTree = async (userId: string, preferredSide?: 'left' | 'right', placementParentId?: string) => {
    try {
        const user = await User.findById(userId);
        if (!user || user.isPlacedInTree) {
            console.log(`User ${userId} not found or already placed.`);
            return;
        }

        if (!user.referrer) {
            // No referrer, mark as placed (Root or Orphan)
            user.isPlacedInTree = true;
            await user.save();
            console.log(`User ${user.email} placed as root/orphan (no referrer).`);
            return;
        }

        // Determine Placement Root (Start of Search)
        // Default: Referrer
        // Explicit: placementParentId (if valid)
        let placementRef = await User.findById(user.referrer);

        if (placementParentId) {
            const explicitParent = await User.findById(placementParentId);
            if (explicitParent) {
                console.log(`Using EXPLICIT placement parent: ${explicitParent.email} (instead of referrer ${placementRef?.email})`);
                placementRef = explicitParent;
            } else {
                console.warn(`Explicit placement parent ${placementParentId} NOT FOUND. Falling back to referrer.`);
            }
        }

        if (!placementRef) return;

        const queue = [placementRef._id]; // Start with ID

        // Apply Preference Logic (Override Queue if needed)
        // If 'left' preference -> Only look at Left Subtree (or start there)
        // If 'right' preference -> Only look at Right Subtree

        // const preference = preferredSide || (placementRef as any).placementPreference || 'auto';
        // [MODIFIED] Force 'auto' if no specific side is requested (User request: Normal link = Auto/Left-to-Right)
        const preference = preferredSide || 'auto';
        console.log(`Placement Preference for ${placementRef.email}: ${preference} (Normal Link defaults to Auto)`);

        if (preference === 'left') {
            if (!placementRef.leftChild) {
                // Direct Left Empty - Place here
                placementRef.leftChild = user._id as mongoose.Types.ObjectId;
                await placementRef.save();

                user.placementParent = placementRef._id as mongoose.Types.ObjectId;
                user.isPlacedInTree = true;
                await user.save();
                console.log(`Placed ${user.email} in IMMEDIATE LEFT of ${placementRef.email} (Pref: Left)`);
                await updateUplineCounts(user._id.toString());
                return;
            } else {
                // Left Occupied - BFS ONLY on Left Subtree
                queue.length = 0; // Clear queue
                queue.push(placementRef.leftChild); // Start BFS from Left Child
            }
        } else if (preference === 'right') {
            if (!placementRef.rightChild) {
                // Direct Right Empty - Place here
                placementRef.rightChild = user._id as mongoose.Types.ObjectId;
                await placementRef.save();

                user.placementParent = placementRef._id as mongoose.Types.ObjectId;
                user.isPlacedInTree = true;
                await user.save();
                console.log(`Placed ${user.email} in IMMEDIATE RIGHT of ${placementRef.email} (Pref: Right)`);
                await updateUplineCounts(user._id.toString());
                return;
            } else {
                // Right Occupied - BFS ONLY on Right Subtree
                queue.length = 0; // Clear queue
                queue.push(placementRef.rightChild); // Start BFS from Right Child
            }
        }
        // If 'auto', queue starts with [user.referrer] and we do standard BFS


        while (queue.length > 0) {
            const currentId = queue.shift();
            const currentNode = await User.findById(currentId);

            if (!currentNode) continue;

            // Check Left
            if (!currentNode.leftChild) {
                currentNode.leftChild = user._id as mongoose.Types.ObjectId;
                await currentNode.save();

                user.placementParent = currentNode._id as mongoose.Types.ObjectId;
                user.isPlacedInTree = true;
                await user.save();
                console.log(`Placed ${user.email} in LEFT of ${currentNode.email}`);
                await updateUplineCounts(user._id.toString()); // Update topological counts
                return;
            }

            // Check Right
            if (!currentNode.rightChild) {
                currentNode.rightChild = user._id as mongoose.Types.ObjectId;
                await currentNode.save();

                user.placementParent = currentNode._id as mongoose.Types.ObjectId;
                user.isPlacedInTree = true;
                await user.save();
                console.log(`Placed ${user.email} in RIGHT of ${currentNode.email}`);
                await updateUplineCounts(user._id.toString()); // Update topological counts
                return;
            }

            // If both full, add children to queue to search next level
            if (currentNode.leftChild) queue.push(currentNode.leftChild);
            if (currentNode.rightChild) queue.push(currentNode.rightChild);
        }

    } catch (error) {
        console.error("Error in placeUserInTree:", error);
    }
};


// @desc    Get Pending Placements (Referred users who haven't invested/placed yet)
// @route   GET /api/referrals/pending
// @access  Private
export const getPendingReferrals = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;

        // Find users who have this user as referrer 
        // AND are NOT placed in the tree yet.
        // NOTE: They might have registered but not bought a plan.
        const pendingUsers = await User.find({
            referrer: userId,
            isPlacedInTree: false
        }).select('username email createdAt walletAddress'); // Select simplified fields

        res.json(pendingUsers);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Tree Structure
// @route   GET /api/referrals/tree
// @access  Private
export const getReferralTree = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;

        // Use recursive function or aggregation to build tree
        // For simplicity and depth control, we might fetch fixed depth
        // But for visualizer, we often need the full structure or load-on-demand.
        // Let's fetch the user and populate immediate children recursively.

        // Function to populate tree recursively (limited depth to prevent infinite loops/heavy load)
        const buildTree = async (rootId: any, depth: number = 0, maxDepth: number = 7): Promise<any> => {
            if (depth > maxDepth) return null;

            const node = await User.findById(rootId)
                .select('name username email walletAddress leftChild rightChild referralCode createdAt isPlacedInTree referrer isActive leftVolume rightVolume totalMatched leftCount rightCount leftActiveCount rightActiveCount')
                .populate('referrer', 'email username')
                .lean(); // Use lean() for plain JS objects

            if (!node) return null;

            // Calculate Personal Investment
            const Investment = require('../models/Investment').default;
            const investments = await Investment.find({
                user: node._id,
                status: { $in: ['COMPLETED', 'PAID'] }
            }).select('amountSFT');

            const totalPersonalInvestment = investments.reduce((sum: number, inv: any) => sum + (inv.amountSFT || 0), 0);

            const treeNode: any = {
                ...node,
                personalInvestment: totalPersonalInvestment,
                children: []
            };
            // Note: React-org-chart or others often expect 'children' array

            let left = null;
            let right = null;

            if (node.leftChild) {
                left = await buildTree(node.leftChild, depth + 1, maxDepth);
            }
            if (node.rightChild) {
                right = await buildTree(node.rightChild, depth + 1, maxDepth);
            }

            // Explicitly structure for binary tree visualizers if needed
            // Or just return standard object
            treeNode.left = left;
            treeNode.right = right;

            return treeNode;
        };

        const depthQuery = parseInt(req.query.depth as string) || 7;
        // Limit: 1,000,000 for "All"
        // Logic: User views "3 Levels" -> Root + L1 + L2.
        // GraphLookup Depth: L1 is depth 0. L2 is depth 1.
        // So we need maxDepth 1.
        // Formula: requestDepth - 2.
        // If requestDepth is 1 (Root only), we shouldn't simple subtract.

        let graphMaxDepth: number | undefined = undefined;
        if (depthQuery > 1) {
            const limit = depthQuery > 1000000 ? 1000000 : depthQuery;
            graphMaxDepth = limit - 1;
        }

        const User = require('../models/User').default;
        const Investment = require('../models/Investment').default;

        // 1. Fetch ALL Descendants in One Query
        const aggregation: any[] = [
            { $match: { _id: new mongoose.Types.ObjectId(userId) } }
        ];

        // Only add graphLookup if we want more than just the root (depth > 1)
        if (depthQuery > 1) {
            aggregation.push({
                $graphLookup: {
                    from: 'users',
                    startWith: '$_id',
                    connectFromField: '_id',
                    connectToField: 'placementParent',
                    as: 'descendants',
                    maxDepth: graphMaxDepth,
                    depthField: 'level'
                }
            });
        }

        const result = await User.aggregate(aggregation);

        if (!result || result.length === 0) {
            return res.json(null);
        }

        const rootUser = result[0];
        const descendants = rootUser.descendants || [];

        // Add Root to list for unified processing (level 0)
        rootUser.level = 0;
        const allNodes = [rootUser, ...descendants];

        // 2. Extract IDs for Investment Lookup
        const allUserIds = allNodes.map((u: any) => u._id);

        // 3. Fetch Personal Investments for ALL users in one query
        const investments = await Investment.aggregate([
            {
                $match: {
                    user: { $in: allUserIds },
                    status: { $in: ['COMPLETED', 'PAID'] }
                }
            },
            {
                $group: {
                    _id: "$user",
                    totalInfo: { $sum: "$amountSFT" }
                }
            }
        ]);

        // Map Investments for O(1) Access
        const investmentMap: Record<string, number> = {};
        investments.forEach((inv: any) => {
            investmentMap[inv._id.toString()] = inv.totalInfo;
        });

        // 4.1 Collect Referrer IDs
        const referrerIds = new Set<string>();
        allNodes.forEach((u: any) => {
            if (u.referrer) referrerIds.add(u.referrer.toString());
        });

        // 4.2 Batch Fetch Referrer Details
        const referrerMap: Record<string, any> = {};
        if (referrerIds.size > 0) {
            const referrers = await User.find({ _id: { $in: Array.from(referrerIds) } })
                .select('email username')
                .lean();

            referrers.forEach((ref: any) => {
                referrerMap[ref._id.toString()] = ref;
            });
        }

        // 4. Transform List to Hash Map & structure data
        const nodeMap: Record<string, any> = {};
        allNodes.forEach((u: any) => {
            nodeMap[u._id.toString()] = {
                _id: u._id,
                name: u.name,
                username: u.username,
                email: u.email,
                walletAddress: u.walletAddress,
                referralCode: u.referralCode,
                createdAt: u.createdAt,
                isPlacedInTree: u.isPlacedInTree,
                // Populate Referrer from Map
                referrer: u.referrer && referrerMap[u.referrer.toString()]
                    ? referrerMap[u.referrer.toString()]
                    : u.referrer,
                isActive: u.isActive,
                leftVolume: u.leftVolume,
                rightVolume: u.rightVolume,
                totalMatched: u.totalMatched,
                leftCount: u.leftCount,
                rightCount: u.rightCount,
                leftActiveCount: u.leftActiveCount,
                rightActiveCount: u.rightActiveCount,
                personalInvestment: investmentMap[u._id.toString()] || 0,
                leftChildId: u.leftChild ? u.leftChild.toString() : null, // Store ID to link later
                rightChildId: u.rightChild ? u.rightChild.toString() : null,
                children: [],
                left: null,
                right: null
            };
        });

        // 5. Build Tree Relationships
        // Iterate map to link parents to children
        Object.values(nodeMap).forEach((node: any) => {
            if (node.leftChildId && nodeMap[node.leftChildId]) {
                node.left = nodeMap[node.leftChildId];
            }
            if (node.rightChildId && nodeMap[node.rightChildId]) {
                node.right = nodeMap[node.rightChildId];
            }
        });

        // 6. Return Root Node (from Map)
        const rootNode = nodeMap[userId.toString()];

        res.json(rootNode);


    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Max Tree Depth (Optimized)
// @route   GET /api/referrals/tree/depth
// @access  Private
export const getReferralTreeDepth = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const User = require('../models/User').default;

        const depthResult = await User.aggregate([
            { $match: { _id: userId } },
            {
                $graphLookup: {
                    from: "users",
                    startWith: "$_id",
                    connectFromField: "_id",
                    connectToField: "placementParent",
                    as: "descendants",
                    depthField: "level"
                }
            },
            {
                $project: {
                    maxLevel: { $max: "$descendants.level" }
                }
            }
        ]);

        const totalDepth = (depthResult.length > 0 && depthResult[0].maxLevel !== undefined)
            ? depthResult[0].maxLevel + 2 // +2 because graphLookup starts at 0 for 1st gen children. (Root=1, Child=2)
            : 1;

        res.json({ totalDepth });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Admin Referral Tree (for specific user)
// @route   GET /api/referrals/admin/tree/:userId
// @access  Private/Admin
export const getAdminReferralTree = async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;

        // Reuse buildTree logic or duplicate it. Since buildTree is inside getReferralTree scope in original code (wait, checked view_file, yes it is inside),
        // I need to either move buildTree out or copy it. Copying is safer to avoid refactoring risk now.

        // Function to populate tree recursively (limited depth)
        const buildTree = async (rootId: any, depth: number = 0, maxDepth: number = 7): Promise<any> => {
            if (depth > maxDepth) return null;

            const User = require('../models/User').default;
            const node = await User.findById(rootId)
                .select('name username email walletAddress leftChild rightChild referralCode createdAt isPlacedInTree referrer isActive leftVolume rightVolume totalMatched leftCount rightCount leftActiveCount rightActiveCount')
                .populate('referrer', 'email username')
                .lean();

            if (!node) return null;

            // Calculate Personal Investment
            const Investment = require('../models/Investment').default;
            const investments = await Investment.find({
                user: node._id,
                status: { $in: ['COMPLETED', 'PAID'] }
            }).select('amountSFT');

            const totalPersonalInvestment = investments.reduce((sum: number, inv: any) => sum + (inv.amountSFT || 0), 0);

            const treeNode: any = {
                ...node,
                personalInvestment: totalPersonalInvestment,
                children: []
            };

            let left = null;
            let right = null;

            if (node.leftChild) {
                left = await buildTree(node.leftChild, depth + 1, maxDepth);
            }
            if (node.rightChild) {
                right = await buildTree(node.rightChild, depth + 1, maxDepth);
            }

            treeNode.left = left;
            treeNode.right = right;

            return treeNode;
        };

        const treeData = await buildTree(userId);
        res.json(treeData);

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Distribute Referral Income
// @access  Internal
export const distributeReferralIncome = async (investmentId: string) => {
    try {
        console.log(`🎁 Distributing referral income for investment: ${investmentId}`);
        const Investment = require('../models/Investment').default; // Dynamic import to avoid circular dependency if any
        const Transaction = require('../models/Transaction').default;
        const IncomeSettings = require('../models/IncomeSettings').default;

        const investment = await Investment.findById(investmentId).populate('user');
        if (!investment) {
            console.error("Investment not found for referral distribution");
            return;
        }

        const user = investment.user;
        if (!user.referrer) {
            console.log("User has no referrer, skipping referral income.");
            return;
        }

        const referrer = await User.findById(user.referrer);
        if (!referrer) {
            console.log("Referrer not found.");
            return;
        }

        // Fetch Income Settings
        const settings = await IncomeSettings.findOne();
        if (!settings) {
            console.error("Income settings not found!");
            return;
        }

        const referralPercentage = settings.referralIncome; // Percentage now
        if (referralPercentage <= 0) {
            console.log("Referral income percentage is 0, skipping.");
            return;
        }

        const investmentAmount = investment.amountSFT;
        const referralAmount = investmentAmount * (referralPercentage / 100);

        if (referralAmount <= 0) {
            console.log("Calculated referral amount is 0, skipping.");
            return;
        }

        console.log(`💸 Crediting ${referralAmount} SFT (${referralPercentage}%) to ${referrer.username || referrer.email} for referring ${user.username || user.email}`);

        // [FIX] Check Active Status
        let status = 'COMPLETED';
        if (!referrer.isActive) {
            status = 'SKIPPED';
            console.log(`   ⚠️ Referrer ${referrer.email} is INACTIVE. Referral Income SKIPPED.`);
        }

        // [NEW] Check Income Cap - REMOVED (Cap at Withdrawal)
        let finalAmount = referralAmount;
        let isCapped = false;
        if (status === 'COMPLETED') {
            // const capResult = await checkAndCapIncome(referrer._id.toString(), referralAmount);
            // finalAmount = capResult.amount;
            // isCapped = capResult.isCapped;
            // if (isCapped) console.log(`   ⚠️ Referral Income Capped...`);

            if (finalAmount > 0) {
                await User.findByIdAndUpdate(referrer._id, {
                    $inc: { totalEarnedIncome: finalAmount }
                });
            }
        }

        // Create Referral Reward Transaction
        if (finalAmount > 0 || status === 'SKIPPED') {
            await Transaction.create({
                user: referrer._id,
                plan: investment.plan,
                investment: investment._id, // Link to the source investment
                type: 'REFERRAL_REWARD',
                amountSFT: finalAmount,
                amountSFTAllocated: finalAmount,
                status: status, // COMPLETED or SKIPPED
                txHash: undefined // Internal system credit, no blockchain hash yet usually
            });

            if (status === 'COMPLETED') {
                await notifyUser(referrer._id.toString(), 'Referral Reward', `You earned ${finalAmount} SFT referral income from ${user.username || 'a new member'}.${isCapped ? ' (Capped)' : ''}`);
            }
        }

        console.log("✅ Referral income distributed successfully.");

    } catch (error) {
        console.error("❌ Error distributing referral income:", error);
    }
};

// @desc    Get Referral Earnings (Aggregated)
// @route   GET /api/referrals/earnings
// @access  Private
export const getReferralEarnings = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const Transaction = require('../models/Transaction').default;

        const earnings = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'REFERRAL_REWARD',
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    totalEarnings: { $sum: "$amountSFT" }
                }
            }
        ]);

        const total = earnings.length > 0 ? earnings[0].totalEarnings : 0;
        res.json({ totalReferralEarnings: total });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Distribute Level Income (Percentage Based - TREE PLACEMENT)
// @access  Internal
export const distributeLevelIncome = async (investmentId: string) => {
    try {
        console.log(`📊 Starting Level Income distribution for investment: ${investmentId}`);
        const Investment = require('../models/Investment').default;
        const Transaction = require('../models/Transaction').default;
        const User = require('../models/User').default; // Ensure User is imported
        const IncomeSettings = require('../models/IncomeSettings').default;

        const investment = await Investment.findById(investmentId).populate('user');
        if (!investment) {
            console.error("Investment not found for level distribution");
            return;
        }

        // Fetch Income Settings
        const settings = await IncomeSettings.findOne();
        if (!settings || !settings.levelIncome || settings.levelIncome.length === 0) {
            console.log("No level income settings configured.");
            return;
        }

        const levels = settings.levelIncome; // Array of percentages [10, 5, 2, 1, ...]
        const investmentAmount = investment.amountSFT;

        let currentUser = investment.user;

        // Traverse up the tree using PLACEMENT (Physical Structure)
        for (let i = 0; i < levels.length; i++) {
            // Find physical parent of current user
            if (!currentUser.placementParent) {
                console.log(`Level ${i + 1}: No placement parent found. Stopping distribution.`);
                break;
            }

            const upline = await User.findById(currentUser.placementParent);
            if (!upline) {
                console.log(`Level ${i + 1}: Upline user not found.`);
                break;
            }

            const percentage = levels[i];
            if (percentage > 0) {
                const commission = investmentAmount * (percentage / 100);

                if (commission > 0) {
                    console.log(`Level ${i + 1}: Crediting ${commission} SFT (${percentage}%) to ${upline.username || upline.email}`);

                    // [FIX] Check Active Status
                    let status = 'COMPLETED';
                    if (!upline.isActive) {
                        status = 'SKIPPED';
                        console.log(`   ⚠️ Upline ${upline.email} is INACTIVE. Level Income SKIPPED.`);
                    }

                    // [NEW] Check Income Cap - REMOVED
                    let finalAmount = commission;
                    let isCapped = false;
                    if (status === 'COMPLETED') {
                        // const capResult = await checkAndCapIncome(upline._id.toString(), commission);
                        // finalAmount = capResult.amount;
                        // isCapped = capResult.isCapped;

                        if (finalAmount > 0) {
                            await User.findByIdAndUpdate(upline._id, {
                                $inc: { totalEarnedIncome: finalAmount }
                            });
                        }
                    }

                    if (finalAmount > 0 || status === 'SKIPPED') {
                        await Transaction.create({
                            user: upline._id,
                            plan: investment.plan,
                            investment: investment._id,
                            type: 'LEVEL_INCOME',
                            amountSFT: finalAmount,
                            amountSFTAllocated: finalAmount,
                            status: status, // COMPLETED or SKIPPED
                            txHash: undefined
                        });

                        if (status === 'COMPLETED') {
                            await notifyUser(upline._id.toString(), 'Level Income', `You received ${finalAmount} SFT Level Income (Level ${i + 1}).${isCapped ? ' (Capped)' : ''}`);
                        }
                    }
                }
            }

            // Move up to the next physical parent
            currentUser = upline;
        }

        console.log("✅ Level income distribution completed (Placement Tree).");

    } catch (error) {
        console.error("❌ Error distributing level income:", error);
    }
};

// @desc    Update Binary Volumes and Calculate Matching Income
// @access  Internal
export const updateBinaryVolumes = async (investmentId: string) => {
    try {
        console.log(`⚖️ Aggregating Binary Volume for investment: ${investmentId}`);
        const Investment = require('../models/Investment').default;
        const User = require('../models/User').default;

        const investment = await Investment.findById(investmentId).populate('user');
        if (!investment) {
            console.error("Investment not found for volume update");
            return;
        }

        const investmentAmount = investment.amountSFT;
        let currentUser = await User.findById(investment.user._id);

        if (!currentUser || !currentUser.isPlacedInTree) {
            console.log("User not placed in tree yet, cannot update volumes.");
            return;
        }

        // Check if this investment makes the user Active (First Investment)
        // If the user is currently NOT active (before this function completes fully or if we check logic), we trigger active count update.
        // Assuming 'isActive' flag is updated elsewhere OR we check it here. 
        // Logic: If user.isActive is FALSE, we set it TRUE and update uplines.
        // NOTE: Usually isActive is set upon Investment Creation. If it was already set true there, we can't detect transition here easily without checking previous state.
        // However, we can check if this is the ONLY active investment or if 'isActive' is true. 
        // Let's assume the user is ALREADY marked active by the investment controller. 
        // We need a way to know if we should increment upline active counts.
        // A simple way: Check if user has ONLY ONE active investment (this one).

        // Better approach for now: We won't auto-magically update active counts here to avoid double counting if re-run.
        // Instead, we will rely on the fact that if this is the FIRST time we are processing this investment, we might need to do it.
        // But for safety, I will verify if I should add `updateActiveUplineCounts` call here:
        // "active members count" -> Users who have >= 1 active investment.

        // Let's check if the user was *just* activated. 
        // If isActive is currently false (and we are about to treat them as active?), or if we rely on the caller.
        // For this task, I will add a check: if user.isActive is false, set it to true and update upline active counts.

        if (!currentUser.isActive) {
            console.log(`User ${currentUser.email} becoming ACTIVE.`);
            currentUser.isActive = true;
            await currentUser.save();
            await updateActiveUplineCounts(currentUser._id.toString());
        }

        let childNode = currentUser;
        let parentNode = await User.findById(currentUser.placementParent);
        // let depth = 1;

        // Traverse UP the Binary Tree (using placementParent)
        while (parentNode) {
            // console.log(`Processing Upline Level ${depth}: ${parentNode.username || parentNode.email}`);

            // Determine if child is Left or Right of Parent
            let isLeft = false;
            if (parentNode.leftChild && parentNode.leftChild.toString() === childNode._id.toString()) {
                isLeft = true;
            } else if (parentNode.rightChild && parentNode.rightChild.toString() === childNode._id.toString()) {
                isLeft = false;
            } else {
                console.error("Tree inconsistency detected: Child not found in Parent's children list.");
                break;
            }

            // Update Global Volume
            // Update Global Volume (Atomic)
            const updateField = isLeft ? 'leftVolume' : 'rightVolume';

            // Use findByIdAndUpdate for atomic increment to avoid race conditions
            parentNode = await User.findByIdAndUpdate(
                parentNode._id,
                { $inc: { [updateField]: investmentAmount } },
                { new: true } // Return updated doc so matching income uses fresh volume
            );

            // Check & Distribute Matching Income for this Ancestor
            await distributeMatchingIncomeForUser(parentNode, investment.plan);

            // Move Up
            childNode = parentNode;
            parentNode = await User.findById(parentNode.placementParent);
            // depth++;
        }

        console.log("✅ Binary volumes updated and Matching Income distributed.");

    } catch (error) {
        console.error("❌ Error updating binary volumes:", error);
    }
};

// @desc    Update Placement Preference (Auto, Left, Right)
// @route   POST /api/referrals/placement-preference
// @access  Private
export const updatePlacementPreference = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const { preference } = req.body; // 'auto', 'left', 'right'

        if (!['auto', 'left', 'right'].includes(preference)) {
            return res.status(400).json({ message: "Invalid preference. Must be 'auto', 'left', or 'right'." });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.placementPreference = preference;
        await user.save();

        res.json({ message: "Placement preference updated successfully", preference });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Placement Preference
// @route   GET /api/referrals/placement-preference
// @access  Private
export const getPlacementPreference = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const user = await User.findById(userId).select('placementPreference');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ preference: user.placementPreference || 'auto' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
