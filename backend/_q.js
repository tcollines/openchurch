require('dotenv').config({path: process.cwd()+'/.env'});
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL}}});
(async()=>{
 const cols=await p.$queryRawUnsafe("select column_name from information_schema.columns where table_name='departments'");
 console.log('dept cols',cols.map(c=>c.column_name).join(','));
 const t=await p.$queryRawUnsafe("select id,name,status::text,created_at from tenants order by created_at");
 console.log(t);
 const u=await p.$queryRawUnsafe("select email,role::text,tenant_id from users order by created_at desc limit 12");
 console.log(u);
 await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
