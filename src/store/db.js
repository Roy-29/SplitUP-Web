export const MOCK_MEMBERS = [
  { id: 1, name: "John Doe", email: "john@example.com" },
  { id: 2, name: "Sarah Smith", email: "sarah@example.com" },
  { id: 3, name: "Mike Johnson", email: "mike@example.com" },
  { id: 4, name: "Emma Wilson", email: "emma@example.com" }
];

export const MOCK_EXPENSES = [
  {
    id: 1,
    groupId: 1,
    title: "Dinner at Luigi's",
    amount: 120.00,
    paidBy: 1, // John paid
    payerName: "John Doe",
    date: Date.now() - 86400000, // 1 day ago
    notes: "Weekend trip dinner",
    category: "FOOD",
    currencyCode: "USD",
    participants: [
      { memberId: 1, memberName: "John Doe", shareAmount: 40.00 },
      { memberId: 2, memberName: "Sarah Smith", shareAmount: 40.00 },
      { memberId: 3, memberName: "Mike Johnson", shareAmount: 40.00 }
    ]
  },
  {
    id: 2,
    groupId: 1,
    title: "Flight Tickets",
    amount: 450.00,
    paidBy: 2, // Sarah paid
    payerName: "Sarah Smith",
    date: Date.now() - 172800000, // 2 days ago
    notes: "Summer Vacation",
    category: "TRAVEL",
    currencyCode: "USD",
    participants: [
      { memberId: 1, memberName: "John Doe", shareAmount: 225.00 },
      { memberId: 2, memberName: "Sarah Smith", shareAmount: 225.00 }
    ]
  },
  {
    id: 3,
    groupId: 2,
    title: "Groceries",
    amount: 80.00,
    paidBy: 3, // Mike paid
    payerName: "Mike Johnson",
    date: Date.now() - 3600000, // 1 hour ago
    notes: "Apartment 4B",
    category: "GROCERIES",
    currencyCode: "USD",
    participants: [
      { memberId: 1, memberName: "John Doe", shareAmount: 40.00 },
      { memberId: 3, memberName: "Mike Johnson", shareAmount: 40.00 }
    ]
  }
];

export const MOCK_SETTLEMENTS = [];

// LocalStorage Database Wrapper
export class LocalDatabase {
  static init() {
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

  static addExpense(expense) {
    const expenses = this.getExpenses();
    expenses.push({ ...expense, id: Date.now() });
    localStorage.setItem('splitup_expenses', JSON.stringify(expenses));
  }

  static addSettlement(settlement) {
    const settlements = this.getSettlements();
    settlements.push({ ...settlement, id: Date.now() });
    localStorage.setItem('splitup_settlements', JSON.stringify(settlements));
  }

  static clearData() {
    localStorage.removeItem('splitup_members');
    localStorage.removeItem('splitup_expenses');
    localStorage.removeItem('splitup_settlements');
    // Re-initialize to mock defaults so the app doesn't break
    this.initialize();
  }
}
