
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, Account, TransactionType, ParsedTransactionData, CategoryMap, ItemPrediction } from "./types";

/**
 * Always initialize GoogleGenAI with a named parameter using process.env.API_KEY.
 * The application must not ask the user for the key.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseNaturalLanguageInput = async (
  input: string,
  accounts: Account[],
  categories: CategoryMap
): Promise<ParsedTransactionData[] | null> => {
  // Create a new instance right before making an API call for fresh context
  const ai = getAI();
  const accountNames = accounts.map(a => a.name).join(", ");
  const categoryKeys = Object.keys(categories).join(", ");
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const prompt = `
    You are a financial data extractor.
    Today is: ${today}.
    
    Analyze the input text and extract financial transactions.
    Input: "${input}"
    
    Context:
    - User Accounts: [${accountNames}]
    - User Categories: [${categoryKeys}]
    
    Instructions:
    1. Identify every distinct transaction.
    2. Extract 'date' strictly in "YYYY-MM-DD" format. Calculate relative dates (e.g., "yesterday") based on Today (${today}). If no date is mentioned, use ${today}.
    3. Extract description, amount (number), and type (EXPENSE/INCOME/INVESTMENT).
    4. Match 'category' from the provided list. If it doesn't fit, suggest a sensible new one.
    5. Match 'accountNameMatch' to the closest User Account name provided.
    6. Return a JSON Array.
  `;

  try {
    // Basic Text Tasks: 'gemini-3-flash-preview'
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "YYYY-MM-DD" },
              description: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              type: { type: Type.STRING, description: "EXPENSE, INCOME, or INVESTMENT" },
              category: { type: Type.STRING },
              subCategory: { type: Type.STRING },
              accountNameMatch: { type: Type.STRING },
              unitDetails: { type: Type.STRING },
              remarks: { type: Type.STRING },
            },
            required: ["description", "amount", "type", "category", "subCategory", "accountNameMatch"]
          }
        }
      }
    });

    if (response.text) {
      // response.text is a property, do not call as a method
      const cleanJson = response.text.trim();
      const parsed = JSON.parse(cleanJson);
      return Array.isArray(parsed) ? parsed : [parsed];
    }
    return [];
  } catch (error) {
    console.warn("Structured Output failed, retrying with standard prompt...", error);
    
    try {
        const fallbackResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt + "\n\nIMPORTANT: Return strictly a valid JSON array of objects.",
            config: {
                responseMimeType: "application/json"
            }
        });
        
        if (fallbackResponse.text) {
             const cleanJson = fallbackResponse.text.trim();
             const parsed = JSON.parse(cleanJson);
             return Array.isArray(parsed) ? parsed : [parsed];
        }
    } catch (retryError) {
        console.error("Retry failed", retryError);
    }
    return null;
  }
};

export const predictItemDetails = async (
  itemName: string
): Promise<ItemPrediction | null> => {
  const ai = getAI();
  const prompt = `
    Analyze this item name: "${itemName}".
    Predict standard unit (kg, l, pcs, pack, etc), category and sub-category.
    Return valid JSON only.
  `;

  try {
     const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            unit: { type: Type.STRING },
            category: { type: Type.STRING },
            subCategory: { type: Type.STRING }
          }
        }
      }
    });
    
    if (response.text) {
      return JSON.parse(response.text) as ItemPrediction;
    }
    return null;
  } catch (e) {
    console.error("Prediction error", e);
    try {
        const fallback = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt + " Return JSON object with keys: unit, category, subCategory.",
             config: { responseMimeType: "application/json" }
        });
        if (fallback.text) return JSON.parse(fallback.text);
    } catch (e2) {}
    
    return null;
  }
}

/**
 * Runs a chat-based financial analysis.
 */
export const runFinancialAnalysis = async (
  query: string,
  transactions: Transaction[],
  accounts: Account[]
): Promise<string> => {
  const ai = getAI();
  
  // Serialize context data (Limit to recent 100 transactions to manage token limits)
  const recentTx = transactions
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 100);
    
  const contextData = JSON.stringify({
    totalNetWorth: accounts.reduce((acc, curr) => acc + curr.balance, 0),
    accounts: accounts.map(a => ({ name: a.name, type: a.type, balance: a.balance })),
    transactions: recentTx.map(t => ({
      date: t.date,
      desc: t.description,
      amt: t.amount,
      cat: t.category,
      type: t.type,
      acc: accounts.find(a => a.id === t.accountId)?.name
    }))
  });

  const systemInstruction = `
    You are WealthWise, an elite personal financial analyst. 
    You have access to the user's real-time financial data (provided in context).
    
    Context Data: ${contextData}
    
    User Query: "${query}"
    
    Guidelines:
    1. If the dataset is empty or low (less than 3 transactions), kindly inform the user that analysis is limited, but provide general advice based on the account balances.
    2. Be specific. Use the numbers provided. Do not invent data.
    3. Structure your response using Markdown (bolding, bullet points) for readability.
    4. If asked for a "Summary" or "Insight", provide a "3-Point Action Plan": Snapshot, Spending Leak, and Recommendation.
    5. Keep the tone professional, encouraging, and data-driven.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Using Pro for complex reasoning on data
      contents: systemInstruction,
    });
    return response.text || "I'm having trouble analyzing your finances right now.";
  } catch (error) {
    console.error("AI Analysis Error", error);
    return "Connection to WealthWise Intelligence failed. Please try again.";
  }
};
