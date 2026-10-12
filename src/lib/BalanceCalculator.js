/**
 * Balance Calculator with greedy min-transactions debt simplification.
 * Uses net-balance approach: calculate each person's net position,
 * then greedily match largest creditor with largest debtor.
 */

/**
 * Simplify debts using the greedy min-transactions algorithm.
 * @param {Array} balances - Array of Balance objects with memberId, memberName, netBalance
 * @returns {Array} debts - Array of Debt objects indicating who owes whom
 */
export function simplifyDebts(balances) {
    if (!balances || balances.length === 0) return [];

    // Build net balance map: positive = owed money, negative = owes money
    const netBalances = new Map();
    const nameMap = new Map();

    balances.forEach(b => {
        netBalances.set(b.memberId, b.netBalance);
        nameMap.set(b.memberId, b.memberName);
    });

    // Remove zero balances
    for (const [id, balance] of netBalances.entries()) {
        if (Math.abs(balance) < 0.01) {
            netBalances.delete(id);
        }
    }

    // Debtors: negative net balance (owes money). Sorted most negative first.
    const debtors = Array.from(netBalances.entries())
        .filter(([_, balance]) => balance < 0)
        .sort((a, b) => a[1] - b[1]);

    // Creditors: positive net balance (is owed money). Sorted largest positive first.
    const creditors = Array.from(netBalances.entries())
        .filter(([_, balance]) => balance > 0)
        .sort((a, b) => b[1] - a[1]);

    const debts = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const [debtorId, debtorBalance] = debtors[i];
        const [creditorId, creditorBalance] = creditors[j];

        const amount = Math.min(Math.abs(debtorBalance), creditorBalance);

        if (amount > 0.01) {
            debts.push({
                fromMemberId: debtorId,
                toMemberId: creditorId,
                fromMemberName: nameMap.get(debtorId) || '',
                toMemberName: nameMap.get(creditorId) || '',
                amount: Number(amount.toFixed(2)) // Format to 2 decimals to avoid floating point issues
            });
        }

        // Update remaining balances
        debtors[i] = [debtorId, debtorBalance + amount];
        creditors[j] = [creditorId, creditorBalance - amount];

        if (Math.abs(debtors[i][1]) < 0.01) i++;
        if (Math.abs(creditors[j][1]) < 0.01) j++;
    }

    return debts;
}

/**
 * Get the total group balance summary.
 * @param {Array} balances 
 * @returns {Object} totalOwed, totalToReceive
 */
export function getTotalGroupBalance(balances) {
    let totalOwed = 0;
    let totalToReceive = 0;

    balances.forEach(b => {
        if (b.netBalance < 0) {
            totalOwed += Math.abs(b.netBalance);
        } else if (b.netBalance > 0) {
            totalToReceive += b.netBalance;
        }
    });

    return { totalOwed, totalToReceive };
}

/**
 * Helper: Calculate balances from a list of expenses and settlements.
 * @param {Array} members - list of group members {id, name}
 * @param {Array} expenses - list of Expense objects
 * @param {Array} settlements - list of Settlement objects
 * @returns {Array} List of Balance objects
 */
export function calculateBalances(members, expenses, settlements = []) {
    const balanceMap = new Map();

    // Initialize balances
    members.forEach(m => {
        balanceMap.set(m.id, {
            memberId: m.id,
            memberName: m.name,
            totalPaid: 0.0,
            personalSpend: 0.0,
            sharedSpend: 0.0,
            totalOwed: 0.0,
            netBalance: 0.0
        });
    });

    // Process expenses
    expenses.forEach(exp => {
        // Payer
        if (balanceMap.has(exp.paidBy)) {
            const payerBal = balanceMap.get(exp.paidBy);
            payerBal.totalPaid += exp.amount;
        }

        // Participants (Split)
        exp.participants.forEach(p => {
            if (balanceMap.has(p.memberId)) {
                const participantBal = balanceMap.get(p.memberId);
                participantBal.totalOwed += p.shareAmount;
            }
        });
    });

    // Process settlements
    settlements.forEach(set => {
        // paidBy paid someone, so they technically "paid" an expense equivalent
        if (balanceMap.has(set.paidBy)) {
            balanceMap.get(set.paidBy).totalPaid += set.amount;
        }
        // paidTo received money, so it increases their "owed" or decreases their net balance
        if (balanceMap.has(set.paidTo)) {
            balanceMap.get(set.paidTo).totalOwed += set.amount;
        }
    });

    // Calculate net balances
    const balances = Array.from(balanceMap.values());
    balances.forEach(b => {
        // netBalance = amount paid - amount owed
        // positive = gets money back, negative = owes money
        b.netBalance = b.totalPaid - b.totalOwed;
    });

    return balances;
}
