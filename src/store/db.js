export const MOCK_MEMBERS = [];

export const MOCK_EXPENSES = [];

export const MOCK_SETTLEMENTS = [];

// LocalStorage Database Wrapper
export class LocalDatabase {
  static init() {
    const existingMembers = localStorage.getItem('splitup_members');
    if (existingMembers && existingMembers.includes('John Doe')) {
      localStorage.removeItem('splitup_members');
      localStorage.removeItem('splitup_expenses');
    }

    if (!localStorage.getItem('splitup_members')) {
      localStorage.setItem('splitup_members', JSON.stringify(MOCK_MEMBERS));
    }
    if (!localStorage.getItem('splitup_expenses')) {
      localStorage.setItem('splitup_expenses', JSON.stringify(MOCK_EXPENSES));
    }
    if (!localStorage.getItem('splitup_settlements')) {
      localStorage.setItem('splitup_settlements', JSON.stringify(MOCK_SETTLEMENTS));
    }
  }

  static getMembers() {
    return JSON.parse(localStorage.getItem('splitup_members') || '[]');
  }

  static getExpenses() {
    return JSON.parse(localStorage.getItem('splitup_expenses') || '[]');
  }

  static getSettlements() {
    return JSON.parse(localStorage.getItem('splitup_settlements') || '[]');
  }

  static getPersonalExpenses() {
    return JSON.parse(localStorage.getItem('splitup_personal_expenses') || '[]');
  }

  static getPersonalTopics() {
    return JSON.parse(localStorage.getItem('splitup_personal_topics') || '[]');
  }

  static addExpense(expense) {
    const expenses = this.getExpenses();
    expenses.push({ ...expense, id: Date.now() });
    localStorage.setItem('splitup_expenses', JSON.stringify(expenses));
  }

  static addPersonalExpense(expense) {
    const expenses = this.getPersonalExpenses();
    expenses.unshift({ ...expense, id: expense.id || `exp_p_${Date.now()}` });
    localStorage.setItem('splitup_personal_expenses', JSON.stringify(expenses));
  }

  static addPersonalTopic(topic) {
    const topics = this.getPersonalTopics();
    const newTopic = {
      ...topic,
      id: topic.id || `tpc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    };
    topics.unshift(newTopic);
    localStorage.setItem('splitup_personal_topics', JSON.stringify(topics));
    return newTopic;
  }

  static deletePersonalTopic(topicId) {
    const topics = this.getPersonalTopics().filter(t => String(t.id) !== String(topicId));
    localStorage.setItem('splitup_personal_topics', JSON.stringify(topics));
  }

  static addSettlement(settlement) {
    const settlements = this.getSettlements();
    const newSettlement = {
      ...settlement,
      id: settlement.id || `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    settlements.unshift(newSettlement);
    localStorage.setItem('splitup_settlements', JSON.stringify(settlements));
    return newSettlement;
  }

  static deleteExpense(expenseId) {
    const expenses = this.getExpenses().filter(e => String(e.id) !== String(expenseId));
    localStorage.setItem('splitup_expenses', JSON.stringify(expenses));
    const personal = this.getPersonalExpenses().filter(e => String(e.id) !== String(expenseId));
    localStorage.setItem('splitup_personal_expenses', JSON.stringify(personal));
  }

  static updateExpense(expenseId, updatedFields) {
    const expenses = this.getExpenses().map(e => String(e.id) === String(expenseId) ? { ...e, ...updatedFields } : e);
    localStorage.setItem('splitup_expenses', JSON.stringify(expenses));

    const personal = this.getPersonalExpenses().map(e => String(e.id) === String(expenseId) ? { ...e, ...updatedFields } : e);
    localStorage.setItem('splitup_personal_expenses', JSON.stringify(personal));
  }

  static updatePersonalTopic(topicId, updatedFields) {
    const topics = this.getPersonalTopics().map(t => String(t.id) === String(topicId) ? { ...t, ...updatedFields } : t);
    localStorage.setItem('splitup_personal_topics', JSON.stringify(topics));
  }

  static addMember(member) {
    const members = this.getMembers();
    const newMember = {
      ...member,
      id: member.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    members.push(newMember);
    localStorage.setItem('splitup_members', JSON.stringify(members));
    return newMember;
  }

  static updateMember(memberId, updatedFields) {
    const members = this.getMembers().map(m => 
      String(m.id) === String(memberId) ? { ...m, ...updatedFields } : m
    );
    localStorage.setItem('splitup_members', JSON.stringify(members));
  }

  static deleteMember(memberId) {
    const members = this.getMembers().filter(m => String(m.id) !== String(memberId));
    localStorage.setItem('splitup_members', JSON.stringify(members));
  }

  static updateGroup(groupId, updatedFields) {
    const groups = JSON.parse(localStorage.getItem('splitup_groups') || '[]');
    const updated = groups.map(g => String(g.id) === String(groupId) ? { ...g, ...updatedFields } : g);
    localStorage.setItem('splitup_groups', JSON.stringify(updated));
  }

  static deleteSettlement(settlementId) {
    const settlements = this.getSettlements().filter(s => String(s.id) !== String(settlementId));
    localStorage.setItem('splitup_settlements', JSON.stringify(settlements));
  }

  static updateSettlement(settlementId, updatedFields) {
    const settlements = this.getSettlements().map(s => String(s.id) === String(settlementId) ? { ...s, ...updatedFields } : s);
    localStorage.setItem('splitup_settlements', JSON.stringify(settlements));
  }

  static searchUsers(query, excludeUserIds = []) {
    const raw = (query || '').trim().toLowerCase().replace(/^@/, '');
    const current = JSON.parse(localStorage.getItem('splitup_turso_user') || 'null');
    const all = current ? [current] : [];
    const excludeSet = new Set((excludeUserIds || []).map(String));
    return all.filter(u => 
      !excludeSet.has(String(u.id)) && (
        (u.username && u.username.toLowerCase().includes(raw)) ||
        (u.name && u.name.toLowerCase().includes(raw)) ||
        (u.email && u.email.toLowerCase().includes(raw))
      )
    );
  }

  static clearData() {
    localStorage.removeItem('splitup_members');
    localStorage.removeItem('splitup_expenses');
    localStorage.removeItem('splitup_personal_expenses');
    localStorage.removeItem('splitup_personal_topics');
    localStorage.removeItem('splitup_settlements');
    // Re-initialize to mock defaults so the app doesn't break
    this.init();
  }
}

