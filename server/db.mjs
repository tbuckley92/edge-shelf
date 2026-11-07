import postgres from 'postgres';
let pool;
export function database(){
 if(!process.env.DATABASE_URL)throw new Error('Database configuration missing');
 return pool??=postgres(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:true},max:3,prepare:false,idle_timeout:20,connect_timeout:10});
}
export async function transaction(fn){return database().begin(async sql=>{await sql`set local role shelf_backend`;return fn(sql);});}
export async function ownerContext(sql,owner){await sql`select set_config('shelf.owner',${owner},true)`;}
