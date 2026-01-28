export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  INVESTMENT = 'INVESTMENT'
}

export interface User {
  id: string;
  name: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  password?: string;
  isSetup: boolean;
  currency: string;
  skipDeleteConfirmation?: boolean;
}

export interface Account {
  id: string;
  userId: string;
  name: string; // e.g., "HDFC Bank"
  type: string; // SAVINGS, CREDIT, WALLET, etc.
  balance: number;
  
  // Detailed Banking Info
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  minBalance?: number;
  
  // Secrets & Documents
  passwords?: string; // Stored as plain text in this demo, user should be warned
  notes?: string;
  documentImage?: string; // Base64 image string (cheque/passbook)
  
  // Linked cards info (simple text for now)
  linkedCards?: string; 
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  subCategory: string;
  accountId: string;
  unitPrice?: string;
  remarks?: string;
}

export interface RecurringPayment {
  id: string;
  name: string; 
  amount: number;
  dayOfMonth: number;
  accountId: string;
  category: string;
  active: boolean;
  lastPaidDate?: string;
}

export interface GamificationStats {
  saverXP: number;
  spenderXP: number;
  investorXP: number;
  level: number;
}

export interface ParsedTransactionData {
  id?: string; // Added for tracking during bulk edit
  date?: string; 
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  subCategory: string;
  accountNameMatch: string;
  unitDetails?: string;
  remarks?: string;
  isDuplicate?: boolean;
  duplicateWarning?: string;
}

export interface CategoryMap {
  [category: string]: string[];
}

export interface PriceLog {
  id: string;
  date: string;
  itemName: string;
  brand?: string;
  category: string;
  subCategory: string; 
  price: number;
  quantity: number;
  unit: string; 
  pricePerUnit: number;
  saleStatus: boolean;
}

export interface ItemPrediction {
  unit: string;
  category: string;
  subCategory: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}