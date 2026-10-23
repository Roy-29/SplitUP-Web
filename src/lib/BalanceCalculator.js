/**
 * Balance Calculator with greedy min-transactions debt simplification.
 * Uses net-balance approach: calculate each person's net position,
 * then greedily match largest creditor with largest debtor.
 */

/**
 * Check if an identifier (m.id, m.userId, email, or name) matches a member.
 * @param {Object} member - member object { id, userId, name, email }
 * @param {string|number} identifier - identifier to check
 * @returns {boolean}
 */
export function matchesMember(member, identifier) {
    if (!member || identifier === undefined || identifier === null) return false;
    const idStr = String(identifier).trim().toLowerCase();
    if (!idStr) return false;

    if (String(member.id).toLowerCase() === idStr) return true;
    if (member.userId && String(member.userId).toLowerCase() === idStr) return true;
    if (member.email && member.email.trim().toLowerCase() === idStr) return true;
    if (member.name && member.name.trim().toLowerCase() === idStr) return true;
    return false;
}

/**
 * Find the canonical member ID (m.id) for a given identifier within target group members.
 * Supports cross-referencing allMembers if the identifier is a memberId from another group.
 * @param {Array} groupMembers - list of group members
 * @param {string|number} identifier - ID, userId, email, or name
 * @param {Array} allMembers - optional full list of members for cross-group resolution
 * @returns {string|null} canonical member.id or null
 */
export function findMemberKey(groupMembers, identifier, allMembers = []) {
    if (!groupMembers || groupMembers.length === 0 || identifier === undefined || identifier === null) return null;
    
    // 1. Direct match in target group members
    const directFound = groupMembers.find(m => matchesMember(m, identifier));
    if (directFound) return directFound.id;

    // 2. Cross-reference with allMembers if identifier is a member from another group
    if (allMembers && allMembers.length > 0) {
        const idLower = String(identifier).trim().toLowerCase();
        const sourceMem = allMembers.find(m => String(m.id).toLowerCase() === idLower);
        if (sourceMem) {
            const crossFound = groupMembers.find(m => 
                (sourceMem.userId && m.userId && String(m.userId) === String(sourceMem.userId)) ||
                (sourceMem.email && m.email && m.email.toLowerCase() === sourceMem.email.toLowerCase()) ||
                (sourceMem.name && m.name && m.name.toLowerCase() === sourceMem.name.toLowerCase())
            );
            if (crossFound) return crossFound.id;
        }
    }

    return null;
}

/**
 * Check if the given user/member matches a target user or ID.
 * @param {string|Object} memberOrId - member ID or member object
 * @param {string|Object} targetUserOrId - user ID or user object
 * @param {Array} members - list of group members
 * @returns {boolean}
 */
export function isMemberMatch(memberOrId, targetUserOrId, members = []) {
    if (!memberOrId || !targetUserOrId) return false;
    const targetId = typeof targetUserOrId === 'object' ? targetUserOrId.id : targetUserOrId;
    const targetEmail = typeof targetUserOrId === 'object' ? targetUserOrId.email : null;
    const targetName = typeof targetUserOrId === 'object' ? targetUserOrId.name : null;

    if (String(memberOrId) === String(targetId)) return true;

    // Search in members list
    const mem = (members || []).find(m => 
        String(m.id) === String(memberOrId) || 
        (m.userId && String(m.userId) === String(memberOrId)) ||
        matchesMember(m, memberOrId)
    );

    if (mem) {
        if (String(mem.id) === String(targetId)) return true;
        if (mem.userId && String(mem.userId) === String(targetId)) return true;
        if (targetEmail && mem.email && mem.email.toLowerCase() === targetEmail.toLowerCase()) return true;
        if (targetName && mem.name && mem.name.toLowerCase() === targetName.toLowerCase()) return true;
    }

    return false;
}

/**
 * Check if the given user is the debtor in a debt object.
 * @param {Object} debt - { fromMemberId, fromUserId, fromMemberName, toMemberId, ... }
 * @param {Object|string} user - user object or user ID
 * @param {Array} members - list of members for resolving
 * @returns {boolean}
 */
export function isDebtor(debt, user, members = []) {
    if (!debt || !user) return false;
    const uid = typeof user === 'object' ? user.id : user;

    if (debt.fromUserId && String(debt.fromUserId) === String(uid)) return true;
    if (debt.fromMemberId && String(debt.fromMemberId) === String(uid)) return true;

    return isMemberMatch(debt.fromMemberId, user, members);
}

/**
 * Check if the given user is the creditor in a debt object.
 * @param {Object} debt - { toMemberId, toUserId, toMemberName, ... }
 * @param {Object|string} user - user object or user ID
 * @param {Array} members - list of members for resolving
 * @returns {boolean}
 */
export function isCreditor(debt, user, members = []) {
    if (!debt || !user) return false;
    const uid = typeof user === 'object' ? user.id : user;

    if (debt.toUserId && String(debt.toUserId) === String(uid)) return true;
    if (debt.toMemberId && String(debt.toMemberId) === String(uid)) return true;

    return isMemberMatch(debt.toMemberId, user, members);
}

/**
 * Check if the user is involved in the debt (either as debtor or creditor).
 */
export function isUserInvolved(debt, user, members = []) {
    return isDebtor(debt, user, members) || isCreditor(debt, user, members);
}

/**
 * Get the net balance position for a specific user across balance records.
 * @param {Array} balances - array of balance objects from calculateBalances
 * @param {Object|string} user - user object or ID
 * @param {Array} members - members list
 * @returns {Object} { netBalance, totalPaid, totalOwed, settledPaid, settledReceived }
 */
export function getUserBalance(balances, user, members = []) {
    if (!balances || !user) {
        return { netBalance: 0, totalPaid: 0, totalOwed: 0, settledPaid: 0, settledReceived: 0 };
    }

    const uid = typeof user === 'object' ? user.id : user;
    const uemail = typeof user === 'object' ? user.email : null;
    const uname = typeof user === 'object' ? user.name : null;

    const matchedBalances = balances.filter(b => {
        if (b.userId && String(b.userId) === String(uid)) return true;
        if (String(b.memberId) === String(uid)) return true;

        if (members && members.length > 0) {
            const mem = members.find(m => String(m.id) === String(b.memberId));
            if (mem) {
                if (mem.userId && String(mem.userId) === String(uid)) return true;
                if (uemail && mem.email && mem.email.toLowerCase() === uemail.toLowerCase()) return true;
                if (uname && mem.name && mem.name.toLowerCase() === uname.toLowerCase()) return true;
            }
        }
        return false;
    });

    if (matchedBalances.length === 0) {
        return { netBalance: 0, totalPaid: 0, totalOwed: 0, settledPaid: 0, settledReceived: 0 };
    }

    const result = matchedBalances.reduce((acc, b) => ({
        netBalance: Number((acc.netBalance + (b.netBalance || 0)).toFixed(2)),
        totalPaid: Number((acc.totalPaid + (b.totalPaid || 0)).toFixed(2)),
        totalOwed: Number((acc.totalOwed + (b.totalOwed || 0)).toFixed(2)),
        settledPaid: Number((acc.settledPaid + (b.settledPaid || 0)).toFixed(2)),
        settledReceived: Number((acc.settledReceived + (b.settledReceived || 0)).toFixed(2))
    }), { netBalance: 0, totalPaid: 0, totalOwed: 0, settledPaid: 0, settledReceived: 0 });

    // Clean up micro-cent split division inaccuracies (< 0.02)
    if (Math.abs(result.netBalance) < 0.02) {
        result.netBalance = 0;
    }

    return result;
}

/**
 * Simplify debts using the greedy min-transactions algorithm.
 * @param {Array} balances - Array of Balance objects with memberId, memberName, netBalance
 * @param {Array} members - Optional members list for extra metadata resolution
 * @param {string} groupId - Optional group ID to tag the debts
 * @param {string} groupName - Optional group name to tag the debts
 * @returns {Array} debts - Array of Debt objects indicating who owes whom
 */
export function simplifyDebts(balances, members = [], groupId = null, groupName = '') {
    if (!balances || balances.length === 0) return [];

    // Build net balance map and lookup maps
    const netBalances = new Map();
    const infoMap = new Map();

    balances.forEach(b => {
        netBalances.set(b.memberId, Number(b.netBalance || 0));

        // Find matching member for userId & accurate name
        const memberObj = (members || []).find(m => String(m.id) === String(b.memberId));
        infoMap.set(b.memberId, {
            name: b.memberName || memberObj?.name || 'Unknown',
            userId: b.userId || memberObj?.userId || null
        });
    });

    // Remove zero or negligible balances (< 0.01)
    for (const [id, balance] of netBalances.entries()) {
        if (Math.abs(balance) < 0.01) {
            netBalances.delete(id);
        }
    }

    // Debtors: negative net balance (owes money). Sorted most negative first.
    const debtors = Array.from(netBalances.entries())
        .filter(([_, balance]) => balance < -0.009)
        .sort((a, b) => a[1] - b[1]);

    // Creditors: positive net balance (is owed money). Sorted largest positive first.
    const creditors = Array.from(netBalances.entries())
        .filter(([_, balance]) => balance > 0.009)
        .sort((a, b) => b[1] - a[1]);

    const debts = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const [debtorId, debtorBalance] = debtors[i];
        const [creditorId, creditorBalance] = creditors[j];

        const amount = Math.min(Math.abs(debtorBalance), creditorBalance);

        if (amount > 0.01) {
            const debtorInfo = infoMap.get(debtorId) || { name: '', userId: null };
            const creditorInfo = infoMap.get(creditorId) || { name: '', userId: null };

            debts.push({
                fromMemberId: debtorId,
                fromUserId: debtorInfo.userId,
                fromMemberName: debtorInfo.name,
                toMemberId: creditorId,
                toUserId: creditorInfo.userId,
                toMemberName: creditorInfo.name,
                amount: Number(amount.toFixed(2)),
                groupId: groupId || null,
                groupName: groupName || ''
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

    (balances || []).forEach(b => {
        if (b.netBalance < 0) {
            totalOwed += Math.abs(b.netBalance);
        } else if (b.netBalance > 0) {
            totalToReceive += b.netBalance;
        }
    });

    return { 
        totalOwed: Number(totalOwed.toFixed(2)), 
        totalToReceive: Number(totalToReceive.toFixed(2)) 
    };
}

/**
 * Helper: Calculate balances from a list of expenses and settlements.
 * @param {Array} members - list of group members {id, name, userId, email}
 * @param {Array} expenses - list of Expense objects
 * @param {Array} settlements - list of Settlement objects
 * @returns {Array} List of Balance objects
 */
export function calculateBalances(members = [], expenses = [], settlements = [], allMembers = []) {
    const balanceMap = new Map();

    // 1. Initialize balances for all group members
    (members || []).forEach(m => {
        balanceMap.set(m.id, {
            memberId: m.id,
            userId: m.userId || null,
            memberName: m.name,
            totalPaid: 0.0,
            personalSpend: 0.0,
            sharedSpend: 0.0,
            totalOwed: 0.0,
            settledPaid: 0.0,
            settledReceived: 0.0,
            netBalance: 0.0
        });
    });

    // 2. Process group expenses
    (expenses || []).forEach(exp => {
        if (!exp) return;

        // Resolve who paid this bill
        const payerKey = findMemberKey(members, exp.paidByMemberId || exp.paidBy, allMembers);
        const expAmount = Number(exp.amount) || 0;
        
        if (payerKey && balanceMap.has(payerKey)) {
            balanceMap.get(payerKey).totalPaid += expAmount;
        }

        // Parse participants and their shares
        let parts = [];
        if (Array.isArray(exp.participants)) {
            parts = exp.participants;
        } else if (typeof exp.participants === 'string') {
            try {
                parts = JSON.parse(exp.participants);
            } catch (_) {
                parts = [];
            }
        }

        parts.forEach(p => {
            if (!p) return;
            const participantKey = findMemberKey(members, p.memberId || p.userId || p.memberName, allMembers);
            const shareAmount = Number(p.shareAmount) || 0;

            if (participantKey && balanceMap.has(participantKey)) {
                balanceMap.get(participantKey).totalOwed += shareAmount;
            }
        });
    });

    // 3. Process settlements
    // A settlement means payer paid payee:
    // Payer's net position improves (+amount, owes less).
    // Payee's net position decreases (-amount, owed less).
    (settlements || []).forEach(set => {
        if (!set) return;

        const payerKey = findMemberKey(members, set.paidByMemberId || set.paidBy, allMembers);
        const payeeKey = findMemberKey(members, set.paidToMemberId || set.paidTo, allMembers);
        const setAmount = Number(set.amount) || 0;

        if (setAmount <= 0) return;

        if (payerKey && balanceMap.has(payerKey)) {
            balanceMap.get(payerKey).settledPaid += setAmount;
        }

        if (payeeKey && balanceMap.has(payeeKey)) {
            balanceMap.get(payeeKey).settledReceived += setAmount;
        }
    });

    // 4. Calculate final net balances
    // netBalance = (totalPaid - totalOwed) + settledPaid - settledReceived
    // Positive = is owed money (creditor)
    // Negative = owes money (debtor)
    // Zero = settled
    const balances = Array.from(balanceMap.values());
    balances.forEach(b => {
        const net = (b.totalPaid - b.totalOwed) + (b.settledPaid - b.settledReceived);
        b.netBalance = Number(net.toFixed(2));
    });

    return balances;
}
