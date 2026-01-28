import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Transaction, Account, User, GamificationStats, TransactionType, 
  RecurringPayment, CategoryMap, PriceLog, AppSettings, ParsedTransactionData, ChatMessage 
} from './types';
import { parseNaturalLanguageInput, runFinancialAnalysis, predictItemDetails } from './services/geminiService';
import { 
  Wallet, TrendingUp, Zap, Calendar, Plus, Trash2, Download, Award, 
  BrainCircuit, Calculator, Edit2, X, Check, History, Upload, Tag, 
  Save, ChevronLeft, ChevronRight, TrendingDown, AlertCircle, ShoppingCart, Settings, Lock, Moon, Sun, Monitor, Search, Sparkles, Clock, CreditCard, FileText, AlertTriangle, Menu, ArrowUpRight, ArrowDownLeft, PieChart, Home, DollarSign, Play, Eye, Repeat, ArrowRightLeft, PlusCircle, Building2, Landmark, ShieldCheck, Key, Image as ImageIcon, FileSpreadsheet, Send, MessageSquare
} from 'lucide-react';

// --- Constants ---
const STORAGE_KEY_DATA = 'wealthwise_data_v4'; 
const INITIAL_USERS: User[] = [{ id: 'u1', name: 'Primary' }];
const INITIAL_ACCOUNTS: Account[] = [
  { id: '1', userId: 'u1', name: 'HDFC Savings', type: 'SAVINGS', balance: 50000.00, accountNumber: '50100xxx1234', branch: 'Mumbai Main', ifsc: 'HDFC0000123' },
  { id: '2', userId: 'u1', name: 'Cash Wallet', type: 'WALLET', balance: 2000.00 },
];
const INITIAL_CATEGORIES: CategoryMap = {
  "Produce": ["Fruits", "Vegetables"],
  "Utilities": ["Electricity", "Water", "Internet"],
  "Housing": ["Rent", "Maintenance"],
  "Transport": ["Fuel", "Cabs"],
  "Income": ["Salary", "Freelance"]
};
const STANDARD_UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'pack', 'dozen', 'box'];

const formatCurrency = (amount: number) => `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const safeDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false); 
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  // App State
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<RecurringPayment[]>([]);
  const [categories, setCategories] = useState<CategoryMap>(INITIAL_CATEGORIES);
  const [priceLogs, setPriceLogs] = useState<PriceLog[]>([]);
  const [gamification, setGamification] = useState<GamificationStats>({ saverXP: 0, spenderXP: 0, investorXP: 0, level: 1 });
  const [settings, setSettings] = useState<AppSettings>({ theme: 'dark', isSetup: false, currency: 'INR' });

  // UI State
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedUserId, setSelectedUserId] = useState<string>('all'); 
  const [dashboardTimeView, setDashboardTimeView] = useState<'week' | 'month' | 'year'>('month');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [entryMode, setEntryMode] = useState<'ai' | 'manual' | 'import'>('ai');
  const [previewData, setPreviewData] = useState<ParsedTransactionData[] | null>(null);
  
  // AI Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Modals / Forms
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transferData, setTransferData] = useState<{from?: string, to?: string, amount?: number}>({});
  const [newPriceLog, setNewPriceLog] = useState<Partial<PriceLog>>({ unit: 'kg', quantity: 1, itemName: '', price: 0, category: '', subCategory: '' });
  const [isPriceAutoFilling, setIsPriceAutoFilling] = useState(false);
  const [showSecrets, setShowSecrets] = useState<{ [id: string]: boolean }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Initialization
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_DATA);
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setUsers(p.users || INITIAL_USERS);
        setAccounts(p.accounts || INITIAL_ACCOUNTS);
        setTransactions(p.transactions || []);
        setPriceLogs(p.priceLogs || []);
        setRecurringPayments(p.recurringPayments || []);
        setCategories(p.categories || INITIAL_CATEGORIES);
        setGamification(p.gamification || { level: 1, saverXP: 0, spenderXP: 0, investorXP: 0 });
        setSettings(p.settings || { theme: 'dark', isSetup: false, currency: 'INR' });
        setIsAuthenticated(!p.settings?.password);
      } catch (e) { setIsAuthenticated(true); }
    } else { setIsAuthenticated(true); }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify({ users, accounts, transactions, priceLogs, recurringPayments, categories, gamification, settings }));
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [users, accounts, transactions, priceLogs, recurringPayments, categories, gamification, settings, isLoaded]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, activeTab]);

  // Auto-trigger analysis on tab switch if empty
  useEffect(() => {
    if (activeTab === 'analysis' && chatHistory.length === 0 && isLoaded) {
      handleSendChat("Please analyze my current financial situation and give me a summary.");
    }
  }, [activeTab, isLoaded]);

  // Actions
  const handleLogin = () => {
    if (passwordInput === settings.password) { setIsAuthenticated(true); setPasswordInput(''); } 
    else alert("Invalid Code");
  };

  const loadDemoData = () => {
    const d1 = { id: 'd1', userId: 'u1', name: 'HDFC Savings', type: 'SAVINGS', balance: 145000, accountHolder: 'John Doe', accountNumber: '5010012345678', ifsc: 'HDFC0001', branch: 'Andheri', notes: 'Primary salary account' };
    const d2 = { id: 'd2', userId: 'u1', name: 'ICICI Credit Card', type: 'CREDIT', balance: -12450, linkedCards: 'Visa Signature x4452' };
    const d3 = { id: 'd3', userId: 'u1', name: 'Petty Cash', type: 'WALLET', balance: 5400 };
    
    setAccounts([d1, d2, d3]);
    setPriceLogs([
      { id: 'p1', itemName: 'Whole Milk', date: new Date().toISOString(), category: 'Dairy', subCategory: 'Milk', price: 65, quantity: 1, unit: 'l', pricePerUnit: 65, saleStatus: false },
      { id: 'p2', itemName: 'Basmati Rice', date: new Date().toISOString(), category: 'Pantry', subCategory: 'Grains', price: 450, quantity: 5, unit: 'kg', pricePerUnit: 90, saleStatus: true }
    ]);
    
    // Add more diverse transactions for better AI analysis
    const today = new Date();
    setTransactions([
      { id: 't1', date: new Date(today.getFullYear(), today.getMonth(), today.getDate()-1).toISOString(), description: 'Grocery Shopping at Reliance Fresh', amount: 1200, type: TransactionType.EXPENSE, category: 'Produce', subCategory: 'Veg', accountId: 'd1' },
      { id: 't2', date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString(), description: 'Salary Credit - Oct', amount: 85000, type: TransactionType.INCOME, category: 'Income', subCategory: 'Primary', accountId: 'd1' },
      { id: 't3', date: new Date(today.getFullYear(), today.getMonth(), today.getDate()-5).toISOString(), description: 'Starbucks Coffee', amount: 450, type: TransactionType.EXPENSE, category: 'Utilities', subCategory: 'Food', accountId: 'd2' },
      { id: 't4', date: new Date(today.getFullYear(), today.getMonth(), today.getDate()-10).toISOString(), description: 'Uber Trip to Office', amount: 320, type: TransactionType.EXPENSE, category: 'Transport', subCategory: 'Cabs', accountId: 'd2' },
      { id: 't5', date: new Date(today.getFullYear(), today.getMonth(), today.getDate()-2).toISOString(), description: 'Netflix Subscription', amount: 649, type: TransactionType.EXPENSE, category: 'Utilities', subCategory: 'Entertainment', accountId: 'd2' },
    ]);
    setGamification({ level: 4, saverXP: 3200, spenderXP: 450, investorXP: 1200 });
    
    // Clear chat history so AI re-analyzes new data
    setChatHistory([]);
    setActiveTab('analysis'); // Switch to analysis to trigger auto-insight
  };

  const handleSendChat = async (msg: string = chatInput) => {
    if (!msg.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatTyping(true);

    const response = await runFinancialAnalysis(msg, transactions, accounts);
    
    const aiMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'ai', content: response, timestamp: new Date() };
    setChatHistory(prev => [...prev, aiMsg]);
    setIsChatTyping(false);
  };

  const processSmartEntry = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    try {
      const results = await parseNaturalLanguageInput(inputText, accounts, categories);
      if (results) setPreviewData(results.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9) })));
    } catch (e) { alert("AI processing error."); }
    setIsProcessing(false);
  };

  const downloadCsvTemplate = () => {
    const csvContent = "Date,Description,Amount,Type,Category,AccountName\n2023-10-25,Coffee,250,EXPENSE,Beverages,Cash Wallet\n2023-10-26,Dividend,1500,INCOME,Investments,HDFC Savings";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "WealthWise_Import_Template.csv";
    a.click();
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n');
      const results: ParsedTransactionData[] = [];
      for(let i=1; i<lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 6) {
          results.push({
            id: Math.random().toString(36).substr(2, 9),
            date: parts[0],
            description: parts[1],
            amount: parseFloat(parts[2]),
            type: parts[3] as TransactionType,
            category: parts[4],
            subCategory: 'Imported',
            accountNameMatch: parts[5].trim()
          });
        }
      }
      setPreviewData(results);
      setEntryMode('import');
      setActiveTab('input');
    };
    reader.readAsText(file);
  };

  const confirmTransactions = () => {
    if (!previewData) return;
    const newTxs: Transaction[] = [];
    const updatedAccounts = [...accounts];
    previewData.forEach((p, i) => {
      const accIdx = updatedAccounts.findIndex(a => a.name.toLowerCase().includes(p.accountNameMatch.toLowerCase()));
      const acc = updatedAccounts[accIdx !== -1 ? accIdx : 0];
      const tx: Transaction = {
        id: Date.now() + i + '',
        date: p.date || new Date().toISOString(),
        description: p.description,
        amount: p.amount,
        type: p.type,
        category: p.category,
        subCategory: p.subCategory,
        accountId: acc.id
      };
      if (tx.type === TransactionType.INCOME) acc.balance += tx.amount;
      else acc.balance -= tx.amount;
      newTxs.push(tx);
    });
    setTransactions([...newTxs, ...transactions]);
    setAccounts(updatedAccounts);
    setPreviewData(null);
    setInputText('');
    setEntryMode('ai');
    setActiveTab('history');
  };

  const updateAccount = () => {
    if (!editingAccount || !editingAccount.name) return;
    if (editingAccount.id) {
      setAccounts(accounts.map(a => a.id === editingAccount.id ? (editingAccount as Account) : a));
    } else {
      const newAcc: Account = {
        ...editingAccount as Account,
        id: Date.now().toString(),
        userId: 'u1',
        balance: editingAccount.balance || 0
      };
      setAccounts([...accounts, newAcc]);
    }
    setEditingAccount(null);
  };

  const deleteAccount = (id: string) => {
    if (confirm("Delete this account and all history? This cannot be undone.")) {
      setAccounts(accounts.filter(a => a.id !== id));
      setTransactions(transactions.filter(t => t.accountId !== id));
    }
  };

  const handleTransfer = () => {
    if (!transferData.from || !transferData.to || !transferData.amount) return;
    const fromAcc = accounts.find(a => a.id === transferData.from);
    const toAcc = accounts.find(a => a.id === transferData.to);
    if (!fromAcc || !toAcc) return;

    setAccounts(accounts.map(a => {
      if (a.id === fromAcc.id) return { ...a, balance: a.balance - transferData.amount! };
      if (a.id === toAcc.id) return { ...a, balance: a.balance + transferData.amount! };
      return a;
    }));

    setTransactions([{
      id: Date.now() + '',
      date: new Date().toISOString(),
      description: `Transfer: ${fromAcc.name} → ${toAcc.name}`,
      amount: transferData.amount,
      type: TransactionType.EXPENSE,
      category: 'Transfer',
      subCategory: 'Internal',
      accountId: fromAcc.id
    }, ...transactions]);

    setTransferData({});
    setActiveTab('dashboard');
  };

  const savePriceLog = () => {
    if (!newPriceLog.itemName || !newPriceLog.price) return;
    const log: PriceLog = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      itemName: newPriceLog.itemName,
      category: newPriceLog.category || 'General',
      subCategory: newPriceLog.subCategory || 'Misc',
      price: newPriceLog.price,
      quantity: newPriceLog.quantity || 1,
      unit: newPriceLog.unit || 'pcs',
      pricePerUnit: newPriceLog.price / (newPriceLog.quantity || 1),
      saleStatus: !!newPriceLog.saleStatus
    };
    setPriceLogs([log, ...priceLogs]);
    setNewPriceLog({ unit: 'kg', quantity: 1, itemName: '', price: 0, category: '', subCategory: '' });
  };

  const autoFillPrice = async () => {
    if (!newPriceLog.itemName) return;
    setIsPriceAutoFilling(true);
    const p = await predictItemDetails(newPriceLog.itemName);
    if (p) setNewPriceLog(prev => ({ ...prev, unit: p.unit, category: p.category, subCategory: p.subCategory }));
    setIsPriceAutoFilling(false);
  };

  const handleChequeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editingAccount) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingAccount({ ...editingAccount, documentImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSettings = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleBackup = () => {
    const data = { users, accounts, transactions, priceLogs, recurringPayments, categories, gamification, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealthwise-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.users) setUsers(json.users);
        if (json.accounts) setAccounts(json.accounts);
        if (json.transactions) setTransactions(json.transactions);
        if (json.priceLogs) setPriceLogs(json.priceLogs);
        if (json.recurringPayments) setRecurringPayments(json.recurringPayments);
        if (json.categories) setCategories(json.categories);
        if (json.gamification) setGamification(json.gamification);
        if (json.settings) setSettings(json.settings);
        alert("Restored backup successfully!");
      } catch (err) { alert("Invalid backup file."); }
    };
    reader.readAsText(file);
  };

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (dashboardTimeView === 'week') cutoff.setDate(now.getDate() - 7);
    else if (dashboardTimeView === 'month') cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);

    const periodTxs = transactions.filter(t => new Date(t.date) >= cutoff);
    const expenses = periodTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const income = periodTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    return { expenses, income, net: income - expenses };
  }, [transactions, dashboardTimeView]);

  if (!isAuthenticated && isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 font-sans">
        <div className="neo-card p-10 max-w-sm w-full text-center rounded-3xl shadow-2xl">
          <div className="bg-brand-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl"><Lock size={32}/></div>
          <h2 className="text-2xl font-bold mb-2">Vault Locked</h2>
          <p className="text-sm text-slate-500 mb-8">Enter PIN to access your wealth</p>
          <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-3xl tracking-widest outline-none mb-6" maxLength={4} autoFocus />
          <button onClick={handleLogin} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition-colors">Open Vault</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex w-72 p-4 flex-col gap-4 border-r border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="bg-brand-600 p-2 rounded-xl text-white shadow-lg"><Zap size={24}/></div>
          <div><h1 className="font-bold text-lg leading-none">WealthWise</h1><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Finance OS v4</p></div>
        </div>
        
        <nav className="flex-1 space-y-1">
          {[
            { id: 'dashboard', icon: <Home size={20}/>, label: 'Dashboard' },
            { id: 'input', icon: <BrainCircuit size={20}/>, label: 'Add Transactions' },
            { id: 'history', icon: <History size={20}/>, label: 'Ledger History' },
            { id: 'accounts', icon: <Landmark size={20}/>, label: 'Accounts & Banking' },
            { id: 'prices', icon: <ShoppingCart size={20}/>, label: 'Price Index' },
            { id: 'analysis', icon: <PieChart size={20}/>, label: 'AI Insights' },
            { id: 'settings', icon: <Settings size={20}/>, label: 'Settings' },
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-medium text-sm ${activeTab === item.id ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-brand-500 uppercase">Level {gamification.level}</span>
            <Award size={14} className="text-brand-500"/>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all duration-1000" style={{ width: '45%' }}></div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-medium">Wealth Score: 2,450 XP</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="p-4 md:p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md z-30">
          <div>
            <h2 className="text-2xl font-bold tracking-tight capitalize">{activeTab === 'input' ? 'Transaction Entry' : activeTab === 'accounts' ? 'Banking Vault' : activeTab === 'analysis' ? 'Financial Intelligence' : activeTab}</h2>
            <p className="text-xs text-slate-400 font-medium">Tracking {accounts.length} Accounts across {users.length} Users</p>
          </div>
          
          <div className="flex gap-2 relative items-center">
            {transactions.length === 0 && (
              <button 
                onClick={loadDemoData} 
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 mr-2"
              >
                <Play size={14} fill="currentColor"/> <span className="hidden md:inline">Run Demo</span><span className="md:hidden">Demo</span>
              </button>
            )}

            <button 
              onClick={() => setShowAddMenu(!showAddMenu)} 
              className={`w-12 h-12 ${showAddMenu ? 'bg-rose-500 rotate-45' : 'bg-brand-600'} text-white rounded-2xl flex items-center justify-center shadow-xl transition-all`}
            >
              <Plus size={24}/>
            </button>
            
            {showAddMenu && (
              <div className="absolute right-0 top-14 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                <button onClick={() => { setActiveTab('input'); setEntryMode('ai'); setShowAddMenu(false); }} className="w-full px-4 py-3 flex items-center gap-2 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
                  <PlusCircle size={18} className="text-brand-500"/> Add Transaction
                </button>
                <button onClick={() => { setEditingAccount({}); setActiveTab('accounts'); setShowAddMenu(false); }} className="w-full px-4 py-3 flex items-center gap-2 text-sm font-bold border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Landmark size={18} className="text-emerald-500"/> New Account
                </button>
                <button onClick={() => { importInputRef.current?.click(); setShowAddMenu(false); }} className="w-full px-4 py-3 flex items-center gap-2 text-sm font-bold border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <FileSpreadsheet size={18} className="text-amber-500"/> Bulk Import CSV
                </button>
              </div>
            )}
            <input type="file" ref={importInputRef} className="hidden" accept=".csv" onChange={handleBulkImport} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar pb-24 md:pb-6">
          
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-gradient-to-br from-brand-600 to-indigo-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                  <p className="text-sm font-bold opacity-70 uppercase tracking-widest mb-1">Liquid Net Worth</p>
                  <h1 className="text-5xl font-black mb-6 tracking-tight">{formatCurrency(accounts.reduce((s,a)=>s+a.balance, 0))}</h1>
                  <div className="flex gap-6">
                    <div className="bg-white/10 p-3 rounded-2xl"><p className="text-[10px] opacity-60 font-black uppercase mb-1 tracking-widest">Active Accounts</p><p className="text-xl font-bold">{accounts.length}</p></div>
                    <div className="bg-white/10 p-3 rounded-2xl"><p className="text-[10px] opacity-60 font-black uppercase mb-1 tracking-widest">Transactions/Mo</p><p className="text-xl font-bold">{transactions.length}</p></div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                   <div>
                     <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest">Profit/Loss ({dashboardTimeView})</h3>
                       <TrendingUp size={16} className="text-emerald-500"/>
                     </div>
                     <p className={`text-3xl font-black ${dashboardStats.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                       {dashboardStats.net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(dashboardStats.net))}
                     </p>
                   </div>
                   <div className="flex gap-1 bg-slate-50 dark:bg-slate-950 p-1 rounded-xl">
                      {['week', 'month', 'year'].map(v => (
                        <button key={v} onClick={() => setDashboardTimeView(v as any)} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${dashboardTimeView === v ? 'bg-white dark:bg-slate-800 shadow-sm text-brand-500' : 'text-slate-400 hover:text-slate-900'}`}>{v}</button>
                      ))}
                   </div>
                </div>
              </div>

              {/* Robust Fund Flow Visualization */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl">
                <h3 className="font-bold mb-6 flex items-center gap-2"><ArrowRightLeft size={18} className="text-brand-500"/> Inter-Account Transfer</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Debit From</label>
                    <select value={transferData.from} onChange={e=>setTransferData({...transferData, from: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-transparent focus:border-brand-500 outline-none text-sm font-bold">
                      <option value="">Select Account</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Credit To</label>
                    <select value={transferData.to} onChange={e=>setTransferData({...transferData, to: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-transparent focus:border-brand-500 outline-none text-sm font-bold">
                      <option value="">Select Account</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400">Amount</label>
                    <input type="number" placeholder="0.00" value={transferData.amount || ''} onChange={e=>setTransferData({...transferData, amount: parseFloat(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-transparent focus:border-brand-500 outline-none text-sm font-bold" />
                  </div>
                  <button onClick={handleTransfer} className="bg-slate-900 dark:bg-brand-600 text-white h-[44px] rounded-xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all">Move Funds</button>
                </div>
              </div>
            </div>
          )}

          {/* AI Insights / Analysis Tab */}
          {activeTab === 'analysis' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
              {/* Chat Window */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {chatHistory.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
                      <Sparkles size={64} className="text-brand-500 animate-pulse"/>
                      <p className="font-bold text-xl text-center">Initializing WealthWise Intelligence...</p>
                      <p className="text-xs text-slate-500">Analyzing {transactions.length} transactions across {accounts.length} accounts</p>
                   </div>
                ) : (
                  chatHistory.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                       <div className={`max-w-[85%] md:max-w-[70%] p-5 rounded-[2rem] shadow-sm ${
                         msg.role === 'user' 
                           ? 'bg-brand-600 text-white rounded-br-none' 
                           : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                       }`}>
                          {msg.role === 'ai' && <div className="flex items-center gap-2 mb-2 text-xs font-black uppercase text-brand-500 tracking-widest"><Sparkles size={12}/> WealthWise AI</div>}
                          <div className="prose dark:prose-invert prose-sm leading-relaxed whitespace-pre-line font-medium">
                            {msg.content}
                          </div>
                          <div className={`text-[10px] font-bold mt-2 text-right opacity-50 uppercase tracking-widest`}>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                       </div>
                    </div>
                  ))
                )}
                {isChatTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] rounded-bl-none border border-slate-200 dark:border-slate-800 flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input & Suggestions */}
              <div className="p-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 space-y-3">
                 <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['📉 Analyze Spending', '🔮 Forecast Next Month', '💰 Savings Tips', '📊 Investment Review'].map(suggestion => (
                       <button 
                         key={suggestion} 
                         onClick={() => handleSendChat(suggestion)}
                         className="flex-shrink-0 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold hover:border-brand-500 hover:text-brand-500 transition-all whitespace-nowrap"
                       >
                         {suggestion}
                       </button>
                    ))}
                 </div>
                 <div className="relative">
                    <input 
                       value={chatInput}
                       onChange={e => setChatInput(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                       placeholder="Ask WealthWise about your finances..."
                       className="w-full p-4 pr-14 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:border-brand-500 border border-slate-200 dark:border-slate-800 font-bold transition-all"
                    />
                    <button 
                      onClick={() => handleSendChat()}
                      disabled={!chatInput.trim() || isChatTyping}
                      className="absolute right-2 top-2 p-2 bg-brand-600 text-white rounded-xl shadow-lg disabled:opacity-50 disabled:shadow-none transition-all hover:scale-105 active:scale-95"
                    >
                      <Send size={20}/>
                    </button>
                 </div>
              </div>
            </div>
          )}

          {/* Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="space-y-6 max-w-5xl mx-auto py-6">
               <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Manage Banking & Assets</h3>
                  <button onClick={() => setEditingAccount({})} className="bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg"><Plus size={18}/> New Bank/Wallet</button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {accounts.map(acc => (
                    <div key={acc.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg relative overflow-hidden group">
                       <div className="absolute top-0 right-0 p-12 bg-emerald-500/5 rounded-full -mr-6 -mt-6"></div>
                       <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                             <div className="flex items-center gap-3">
                                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl text-slate-400"><Building2 size={24}/></div>
                                <div><h4 className="font-bold text-lg leading-none mb-1">{acc.name}</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{acc.type}</p></div>
                             </div>
                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingAccount(acc)} className="p-2 text-slate-400 hover:text-brand-500 transition-colors"><Edit2 size={18}/></button>
                                <button onClick={() => deleteAccount(acc.id)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-6">
                             <div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Available Balance</p><p className="text-2xl font-black text-brand-600">{formatCurrency(acc.balance)}</p></div>
                             <div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">A/C Number</p><p className="text-sm font-mono font-bold tracking-tighter">{acc.accountNumber || 'N/A'}</p></div>
                          </div>

                          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                             {acc.ifsc && <span className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><ShieldCheck size={12}/> {acc.ifsc}</span>}
                             {acc.branch && <span className="bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1"><Landmark size={12}/> {acc.branch}</span>}
                          </div>
                       </div>
                    </div>
                  ))}
               </div>

               {/* Add/Edit Account Modal Overlay */}
               {editingAccount && (
                 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl p-8 no-scrollbar animate-in zoom-in duration-300">
                       <div className="flex justify-between items-center mb-8">
                          <h3 className="text-2xl font-black">{editingAccount.id ? 'Edit Banking Details' : 'Secure Vault Setup'}</h3>
                          <button onClick={() => setEditingAccount(null)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 hover:text-rose-500"><X/></button>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4 col-span-2">
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Account/Bank Name</label><input className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none focus:border-brand-500 border border-transparent font-bold" value={editingAccount.name || ''} onChange={e=>setEditingAccount({...editingAccount, name: e.target.value})} placeholder="e.g. HDFC Bank" /></div>
                               <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Account Type</label><select className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold outline-none" value={editingAccount.type || 'SAVINGS'} onChange={e=>setEditingAccount({...editingAccount, type: e.target.value})}><option value="SAVINGS">Savings Account</option><option value="CURRENT">Current Account</option><option value="CREDIT">Credit Card</option><option value="WALLET">E-Wallet</option><option value="INVESTMENT">Investment/Demat</option></select></div>
                             </div>
                          </div>

                          <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Account Holder Name</label><input className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-transparent font-bold" value={editingAccount.accountHolder || ''} onChange={e=>setEditingAccount({...editingAccount, accountHolder: e.target.value})} placeholder="Full Name" /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Account Number</label><input className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-transparent font-bold" value={editingAccount.accountNumber || ''} onChange={e=>setEditingAccount({...editingAccount, accountNumber: e.target.value})} placeholder="Acc No." /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">IFSC Code</label><input className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-transparent font-bold" value={editingAccount.ifsc || ''} onChange={e=>setEditingAccount({...editingAccount, ifsc: e.target.value})} placeholder="HDFC0001" /></div>
                          <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Opening Balance</label><input type="number" className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-transparent font-bold" value={editingAccount.balance || 0} onChange={e=>setEditingAccount({...editingAccount, balance: parseFloat(e.target.value)})} placeholder="₹" /></div>

                          <div className="col-span-2 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl space-y-4">
                             <div className="flex items-center gap-2 mb-2"><Key className="text-brand-500" size={18}/> <h4 className="font-bold text-sm uppercase tracking-widest">Vault Secrets (Encrypted View)</h4></div>
                             <div className="relative">
                               <input type={showSecrets[editingAccount.id || 'new'] ? 'text' : 'password'} className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl outline-none border border-transparent font-bold pr-12" value={editingAccount.passwords || ''} onChange={e=>setEditingAccount({...editingAccount, passwords: e.target.value})} placeholder="Stored Login Info / Notes" />
                               <button onClick={() => setShowSecrets({...showSecrets, [editingAccount.id || 'new']: !showSecrets[editingAccount.id || 'new']})} className="absolute right-4 top-4 text-slate-400 hover:text-brand-500 transition-colors">
                                 {showSecrets[editingAccount.id || 'new'] ? <Eye size={20}/> : <Lock size={20}/>}
                               </button>
                             </div>
                             <textarea className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl outline-none border border-transparent font-medium text-sm" placeholder="Additional details (Branch addr, cancelled cheque notes, etc.)" value={editingAccount.notes || ''} onChange={e=>setEditingAccount({...editingAccount, notes: e.target.value})} rows={3}></textarea>
                             
                             <div className="flex flex-col gap-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Cancelled Cheque / Passbook Image</label>
                                <div className="flex items-center gap-4">
                                   <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 transition-all text-xs font-bold text-slate-500">
                                      <ImageIcon size={16}/> Upload Image
                                   </button>
                                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleChequeUpload} />
                                   {editingAccount.documentImage && (
                                     <div className="relative w-16 h-12 rounded-lg overflow-hidden border border-slate-200">
                                        <img src={editingAccount.documentImage} className="w-full h-full object-cover" />
                                        <button onClick={() => setEditingAccount({...editingAccount, documentImage: undefined})} className="absolute top-0 right-0 bg-rose-500 text-white p-0.5 rounded-bl-lg"><X size={10}/></button>
                                     </div>
                                   )}
                                </div>
                             </div>
                          </div>
                       </div>

                       <button onClick={updateAccount} className="w-full mt-8 bg-brand-600 text-white py-4 rounded-3xl font-bold text-lg shadow-xl shadow-brand-500/30 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95 transition-all">
                          <Save size={20}/> Securely Save Account
                       </button>
                    </div>
                 </div>
               )}
            </div>
          )}

          {/* Transaction Entry Tab with Preview/Bulk Editing */}
          {activeTab === 'input' && (
            <div className="max-w-4xl mx-auto space-y-6 py-6 animate-in slide-in-from-right duration-500">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                <button onClick={()=>setEntryMode('ai')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${entryMode==='ai' ? 'bg-white dark:bg-slate-900 shadow-sm text-brand-500' : 'text-slate-400'}`}>Smart AI Entry</button>
                <button onClick={()=>setEntryMode('import')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${entryMode==='import' ? 'bg-white dark:bg-slate-900 shadow-sm text-brand-500' : 'text-slate-400'}`}>Bulk Import CSV</button>
              </div>

              {entryMode === 'ai' ? (
                !previewData ? (
                  <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-40 bg-brand-500/5 rounded-full blur-3xl"></div>
                    <div className="relative z-10 text-center">
                      <h3 className="text-3xl font-black mb-4 tracking-tight">Financial Intuition</h3>
                      <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">"Withdrew 5000 from ATM yesterday using HDFC Card" - Just type or speak and let AI figure it out.</p>
                      <textarea 
                        value={inputText} 
                        onChange={e=>setInputText(e.target.value)} 
                        className="w-full h-64 bg-slate-50 dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-xl outline-none focus:border-brand-500 transition-all font-medium leading-relaxed shadow-inner" 
                        placeholder="e.g., Dinner at Taj for 4500 on ICICI card..."
                      ></textarea>
                      <button onClick={processSmartEntry} disabled={isProcessing} className="w-full mt-8 bg-brand-600 text-white py-5 rounded-[2rem] font-bold text-xl shadow-2xl shadow-brand-500/30 flex items-center justify-center gap-3 active:scale-95 transition-all">
                        {isProcessing ? <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div> : <><BrainCircuit size={24}/> Decipher Transaction</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center px-2">
                       <h3 className="text-2xl font-black">Sync Ledger</h3>
                       <p className="text-xs font-bold text-slate-400">Review, Edit, or Delete before confirming</p>
                    </div>
                    <div className="space-y-3">
                      {previewData.map((p, i) => (
                        <div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-wrap md:flex-nowrap items-center gap-4 relative group shadow-sm">
                           <div className="flex-1 min-w-[200px] space-y-1">
                              <input className="bg-transparent outline-none w-full font-bold text-lg focus:text-brand-500" value={p.description} onChange={e=>{const n=[...previewData]; n[i].description=e.target.value; setPreviewData(n)}} />
                              <div className="flex gap-2">
                                <input type="date" className="bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-500 border-none outline-none" value={p.date} onChange={e=>{const n=[...previewData]; n[i].date=e.target.value; setPreviewData(n)}} />
                                <span className={`text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest ${p.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{p.type}</span>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-lg font-mono font-black">₹</span>
                             <input type="number" className="w-28 bg-slate-50 dark:bg-slate-800 p-2 rounded-xl text-lg font-black text-brand-600" value={p.amount} onChange={e=>{const n=[...previewData]; n[i].amount=parseFloat(e.target.value); setPreviewData(n)}} />
                           </div>
                           <select className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-xs font-bold outline-none" value={p.accountNameMatch} onChange={e=>{const n=[...previewData]; n[i].accountNameMatch=e.target.value; setPreviewData(n)}}>
                              {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                           </select>
                           <button onClick={() => setPreviewData(previewData.filter(x => x.id !== p.id))} className="p-2 text-slate-200 hover:text-rose-500 group-hover:text-slate-400 transition-all"><X size={20}/></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={confirmTransactions} className="w-full bg-emerald-500 text-white py-5 rounded-[2rem] font-bold text-xl shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                       <Check size={24}/> Authorize All Transactions
                    </button>
                  </div>
                )
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl">
                   <div className="flex justify-between items-start mb-8">
                     <div><h3 className="text-3xl font-black mb-2">Mass Import</h3><p className="text-sm text-slate-500">Perfect for importing bank statements or legacy history.</p></div>
                     <button onClick={downloadCsvTemplate} className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold hover:text-brand-500 transition-colors"><Download size={16}/> Get Template</button>
                   </div>
                   
                   <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] p-16 text-center hover:border-brand-500 transition-all cursor-pointer relative group bg-slate-50/50" onClick={() => importInputRef.current?.click()}>
                      <FileSpreadsheet size={64} className="mx-auto text-slate-300 mb-6 group-hover:text-brand-500 transition-colors" />
                      <p className="font-black text-xl mb-1">Click to browse CSV</p>
                      <p className="text-xs text-slate-400">File must follow the WealthWise standard format</p>
                   </div>
                </div>
              )}
            </div>
          )}

          {/* History / Ledger Tab with Edit Mode */}
          {activeTab === 'history' && (
            <div className="space-y-4 max-w-5xl mx-auto py-6">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-2xl font-black">Financial Ledger</h3>
                 <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button className="px-4 py-2 bg-white dark:bg-slate-900 shadow-sm rounded-lg text-xs font-bold text-brand-500">All History</button>
                    <button className="px-4 py-2 text-xs font-bold text-slate-400">Export</button>
                 </div>
               </div>
               
               {transactions.length === 0 && <div className="text-center py-20 opacity-40"><Landmark size={48} className="mx-auto mb-4"/><p className="font-bold">The ledger is empty.</p></div>}
               
               {transactions.map(t => (
                 <div key={t.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between hover:scale-[1.01] transition-all shadow-sm group">
                    <div className="flex items-center gap-5">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${t.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                          {t.type === 'INCOME' ? <ArrowDownLeft size={28}/> : <ArrowUpRight size={28}/>}
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-none mb-1.5">{t.description}</h4>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{safeDate(t.date)} • {t.category}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-right">
                          <p className={`text-xl font-mono font-black ${t.type==='INCOME' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                             {t.type === 'EXPENSE' ? '-' : '+'}{formatCurrency(t.amount)}
                          </p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">via {accounts.find(a=>a.id===t.accountId)?.name || 'Deleted Account'}</p>
                       </div>
                       <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingTransaction(t)} className="p-2 text-slate-300 hover:text-brand-500 transition-colors"><Edit2 size={18}/></button>
                          <button onClick={() => setTransactions(transactions.filter(x => x.id !== t.id))} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18}/></button>
                       </div>
                    </div>
                 </div>
               ))}

               {/* Edit Transaction Modal */}
               {editingTransaction && (
                 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl">
                       <h3 className="text-2xl font-black mb-6">Modify Entry</h3>
                       <div className="space-y-4">
                          <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Description</label><input className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-bold" value={editingTransaction.description} onChange={e=>setEditingTransaction({...editingTransaction, description: e.target.value})} /></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Amount</label><input type="number" className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold" value={editingTransaction.amount} onChange={e=>setEditingTransaction({...editingTransaction, amount: parseFloat(e.target.value)})} /></div>
                            <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 ml-1">Account</label><select className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold" value={editingTransaction.accountId} onChange={e=>setEditingTransaction({...editingTransaction, accountId: e.target.value})}>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                          </div>
                          <button onClick={() => { setTransactions(transactions.map(x => x.id === editingTransaction.id ? editingTransaction : x)); setEditingTransaction(null); }} className="w-full mt-4 bg-brand-600 text-white py-4 rounded-3xl font-bold text-lg">Commit Change</button>
                       </div>
                    </div>
                 </div>
               )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 py-6">
               <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl">
                  <h3 className="text-xl font-bold mb-6">Security & Preferences</h3>
                  <div className="space-y-6">
                     <div className="flex justify-between items-center">
                        <div><p className="font-bold">Vault Visuals</p><p className="text-xs text-slate-500">Dark mode is highly recommended</p></div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                           <button onClick={()=>updateSettings('theme', 'light')} className={`p-2 rounded-lg ${settings.theme==='light' ? 'bg-white shadow-sm text-brand-500' : 'text-slate-400'}`}><Sun size={18}/></button>
                           <button onClick={()=>updateSettings('theme', 'dark')} className={`p-2 rounded-lg ${settings.theme==='dark' ? 'bg-slate-900 shadow-sm text-brand-500' : 'text-slate-400'}`}><Moon size={18}/></button>
                        </div>
                     </div>
                     <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-800 pt-6">
                        <div><p className="font-bold">Primary Vault Code</p><p className="text-xs text-slate-500">4-digit access PIN for index page</p></div>
                        <input 
                           type="password" 
                           maxLength={4} 
                           placeholder="••••" 
                           className="w-24 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-center font-bold outline-none border border-transparent focus:border-brand-500" 
                           value={settings.password || ''}
                           onChange={e => updateSettings('password', e.target.value)}
                        />
                     </div>
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl">
                  <h3 className="text-xl font-bold mb-6">Ledger Persistence</h3>
                  <div className="grid grid-cols-2 gap-4">
                     <button onClick={handleBackup} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold flex flex-col items-center gap-2 hover:bg-brand-500/10 hover:text-brand-500 transition-all">
                        <Download size={24}/> Backup Vault
                     </button>
                     <label className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold flex flex-col items-center gap-2 cursor-pointer hover:bg-brand-500/10 hover:text-brand-500 transition-all">
                        <Upload size={24}/> Restore History
                        <input type="file" className="hidden" accept=".json" onChange={handleRestore} />
                     </label>
                  </div>
                  <button onClick={()=>{if(confirm("Wipe all data?")) { localStorage.removeItem(STORAGE_KEY_DATA); window.location.reload(); }}} className="w-full mt-8 py-4 text-rose-500 font-bold border-2 border-dashed border-rose-500/20 rounded-2xl hover:bg-rose-500/5 transition-all">Hard Reset Vault</button>
               </div>
            </div>
          )}

          {/* Price Index Tab */}
          {activeTab === 'prices' && (
            <div className="space-y-6 py-6 max-w-5xl mx-auto">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-xl">
                 <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-brand-500"><ShoppingCart size={28}/> Grocery Price Watch</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="relative">
                       <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Item Name</label>
                       <input 
                          placeholder="e.g. Olive Oil" 
                          className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none focus:border-brand-500 border border-transparent font-bold" 
                          value={newPriceLog.itemName || ''} 
                          onChange={e=>setNewPriceLog({...newPriceLog, itemName: e.target.value})}
                          onBlur={autoFillPrice}
                       />
                       {isPriceAutoFilling && <div className="absolute right-4 top-10 animate-spin text-brand-500"><Zap size={20}/></div>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Total Amount Paid</label>
                      <input type="number" placeholder="₹" className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold" value={newPriceLog.price || ''} onChange={e=>setNewPriceLog({...newPriceLog, price: parseFloat(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Quantity & Unit</label>
                      <div className="flex gap-2">
                        <input type="number" placeholder="Qty" className="w-20 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold" value={newPriceLog.quantity || ''} onChange={e=>setNewPriceLog({...newPriceLog, quantity: parseFloat(e.target.value)})} />
                        <select className="flex-1 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-bold uppercase" value={newPriceLog.unit} onChange={e=>setNewPriceLog({...newPriceLog, unit: e.target.value})}>
                            {STANDARD_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                 </div>
                 <button onClick={savePriceLog} className="w-full mt-8 bg-brand-600 text-white py-5 rounded-[2rem] font-bold text-lg shadow-xl shadow-brand-500/30 hover:scale-[1.01] active:scale-95 transition-all">Log Price Index</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                 {priceLogs.map(log => (
                    <div key={log.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 hover:shadow-2xl transition-all relative group">
                       <button onClick={()=>setPriceLogs(priceLogs.filter(l=>l.id!==log.id))} className="absolute top-4 right-4 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16}/></button>
                       <div className="flex justify-between items-start mb-4">
                          <div>
                            <span className="text-[10px] font-black bg-brand-50 dark:bg-brand-900/20 text-brand-500 px-3 py-1 rounded-full uppercase tracking-tighter">{log.category}</span>
                            <h4 className="font-black text-xl leading-tight mt-2">{log.itemName}</h4>
                          </div>
                          <p className="text-2xl font-mono font-black text-brand-600">₹{log.pricePerUnit.toFixed(2)}<span className="text-xs font-medium text-slate-400">/{log.unit}</span></p>
                       </div>
                       <div className="flex justify-between items-center text-[10px] text-slate-400 font-black uppercase tracking-widest border-t border-slate-50 dark:border-slate-800 pt-4">
                          <span>Total: {formatCurrency(log.price)}</span>
                          <span>{safeDate(log.date)}</span>
                       </div>
                    </div>
                 ))}
              </div>
            </div>
          )}

        </div>

        {/* Floating Add Menu (Mobile optimized) */}
        <div className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-40">
           <div className={`flex items-center gap-3 transition-all duration-300 ${showAddMenu ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
              <button onClick={() => { setEditingAccount({}); setActiveTab('accounts'); setShowAddMenu(false); }} className="w-14 h-14 bg-emerald-500 text-white rounded-2xl shadow-xl flex items-center justify-center"><Building2 size={24}/></button>
              <button onClick={() => { setActiveTab('input'); setEntryMode('ai'); setShowAddMenu(false); }} className="w-14 h-14 bg-brand-500 text-white rounded-2xl shadow-xl flex items-center justify-center"><BrainCircuit size={24}/></button>
           </div>
           <button onClick={()=>setShowAddMenu(!showAddMenu)} className={`w-16 h-16 ${showAddMenu ? 'bg-rose-500 rotate-45 shadow-rose-500/30' : 'bg-slate-900 dark:bg-brand-600 shadow-brand-500/30'} text-white rounded-[1.5rem] shadow-2xl flex items-center justify-center transition-all duration-300 active:scale-90`}><Plus size={32}/></button>
        </div>

        {/* Bottom Nav (Mobile) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex justify-around items-center px-4 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
           <button onClick={()=>setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 transition-all ${activeTab==='dashboard' ? 'text-brand-500' : 'text-slate-400'}`}><Home size={22}/><span className="text-[8px] font-black uppercase">Home</span></button>
           <button onClick={()=>setActiveTab('history')} className={`flex flex-col items-center gap-1 transition-all ${activeTab==='history' ? 'text-brand-500' : 'text-slate-400'}`}><History size={22}/><span className="text-[8px] font-black uppercase">Ledger</span></button>
           <div className="w-14"></div> {/* Space for center button */}
           <button onClick={()=>setActiveTab('accounts')} className={`flex flex-col items-center gap-1 transition-all ${activeTab==='accounts' ? 'text-brand-500' : 'text-slate-400'}`}><Landmark size={22}/><span className="text-[8px] font-black uppercase">Vault</span></button>
           <button onClick={()=>setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-all ${activeTab==='settings' ? 'text-brand-500' : 'text-slate-400'}`}><Menu size={22}/><span className="text-[8px] font-black uppercase">Menu</span></button>
        </div>
      </main>
    </div>
  );
}
