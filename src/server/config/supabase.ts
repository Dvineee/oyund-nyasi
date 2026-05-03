import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

/**
 * Supabase İstemcisi
 * Veritabanı sorguları ve yetkilendirme işlemleri için kullanılır.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Supabase bağlantısını test et (Basit bir sorgu ile)
 */
export async function testSupabaseConnection() {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase URL veya Anon Key eksik! Lütfen .env dosyanızı kontrol edin.");
    }
    
    // Basit bir health check benzeri işlem
    const { data, error } = await supabase.from("_dummy_check_").select("*").limit(1);
    
    // _dummy_check_ tablosu olmasa bile hata mesajından bağlantının kurulup kurulmadığını anlayabiliriz
    if (error && error.code !== "PGRST116" && error.code !== "42P01") {
      throw error;
    }
    
    console.log("✅ Supabase bağlantısı hazır.");
  } catch (error) {
    console.error("⚠️ Supabase bağlantı uyarısı:", (error as Error).message);
    console.warn("📌 Not: Supabase URL ve Key girmeden veritabanı özellikleri çalışmayacaktır.");
  }
}
