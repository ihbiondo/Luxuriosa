import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY = Deno.env.get("INFINITEPAY_API_KEY") || "";
const HANDLE = Deno.env.get("INFINITEPAY_HANDLE") || "";
const WEBHOOK = "https://byiykxfugvxuowueuxca.supabase.co/functions/v1/infinitepay-test-webhook";
const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ORIGINS = new Set(["https://luxuriosa.com.br", "https://www.luxuriosa.com.br"]);

function reply(body: unknown, status=200, origin="") {
  return new Response(status===204?null:JSON.stringify(body), {status,headers:{
    "content-type":"application/json; charset=utf-8",
    "access-control-allow-origin":ORIGINS.has(origin)?origin:"https://luxuriosa.com.br",
    "access-control-allow-headers":"authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-retry-count, traceparent, tracestate, baggage",
    "access-control-allow-methods":"POST, OPTIONS","vary":"Origin","cache-control":"no-store"
  }});
}
async function requireAdmin(req: Request) {
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token) throw new Error("Faça login com a conta administrativa.");
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data.user) throw new Error("Sessão inválida.");
  const {data:permission,error:permissionError}=await admin.from("user_permissions")
    .select("role").eq("user_id",data.user.id).maybeSingle();
  if(permissionError) throw permissionError;
  if(permission?.role!=="admin") throw new Error("Acesso restrito à administração.");
  return data.user;
}
function clean(v: unknown,max=200){return typeof v==="string"?v.trim().slice(0,max):"";}

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin")||"";
 if(req.method==="OPTIONS") return reply({},204,origin);
 if(req.method!=="POST") return reply({error:"Método não permitido."},405,origin);
 if(origin&&!ORIGINS.has(origin)) return reply({error:"Origem não autorizada."},403,origin);
 try {
  const user=await requireAdmin(req);
  const body=await req.json();
  if(body?.action==="create"){
   if(!API_KEY||!HANDLE) return reply({error:"Credenciais InfinitePay não configuradas."},503,origin);
   const {data:existing,error:existingError}=await admin.from("infinitepay_test_payments")
    .select("order_nsu,status,checkout_url,created_at").eq("created_by",user.id)
    .in("status",["pending","paid","review_required"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
   if(existingError) throw existingError;
   if(existing?.status==="paid"||existing?.status==="review_required") return reply({error:"O teste anterior já foi concluído ou exige conferência. Não será criada outra cobrança."},409,origin);
   if(existing?.status==="pending"&&existing.checkout_url){
    const createdAt=Date.parse(existing.created_at);
    const linkExpired=Number.isFinite(createdAt)&&Date.now()>=createdAt+30*60*1000;
    if(linkExpired) return reply({
     error:"O link de teste de R$ 1,00 expirou. Antes de criar outra cobrança, confira em Suas vendas > Checkout integrado se esse pagamento entrou. O sistema bloqueou uma nova cobrança para evitar duplicidade.",
     test:true,review_required:true,order_nsu:existing.order_nsu
    },409,origin);
    return reply({ok:true,test:true,reused:true,amount:"R$ 1,00",
     order_nsu:existing.order_nsu,checkout_url:existing.checkout_url,
     warning:"Já existe um único teste pendente. Nenhuma nova cobrança foi criada."},200,origin);
   }
   const orderNsu=crypto.randomUUID();
   const expiresAt=new Date(Date.now()+30*60*1000);
   const {error:insertError}=await admin.from("infinitepay_test_payments").insert({
    created_by:user.id,order_nsu:orderNsu,amount_cents:100,status:"pending"
   });
   if(insertError?.code==="23505") return reply({error:"Já existe um teste de pagamento pendente para esta conta administrativa."},409,origin);
   if(insertError) throw insertError;
   const payload={
    order_nsu:orderNsu,
    redirect_url:"https://luxuriosa.com.br/",
    webhook:{url:WEBHOOK,events:["paid","settled"]},
    items:[{quantity:1,price:100,description:"Teste técnico de pagamento Luxuriosa — R$ 1,00"}],
    options:{single_payment:true,valid_until:expiresAt.toISOString(),require_delivery_address:false,payment_methods_enabled:["credit_card","pix"]}
   };
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),10000);
   let response:Response;
   try { response=await fetch("https://api.checkout.infinitepay.io/links",{
    method:"POST",headers:{"content-type":"application/json","X-Api-Key":API_KEY},
    body:JSON.stringify(payload),signal:controller.signal
   }); } finally { clearTimeout(timer); }
   const raw=await response.text(); let result:any={};
   try{result=raw?JSON.parse(raw):{};}catch{}
   const link=clean(result?.url??result?.data?.url,1000);
   let host="";try{host=new globalThis.URL(link).hostname;}catch{}
   if(!response.ok||!link.startsWith("https://")||!["checkout.infinitepay.io","checkout.infinitepay.com.br"].includes(host)){
    await admin.from("infinitepay_test_payments").update({status:"failed",updated_at:new Date().toISOString()}).eq("order_nsu",orderNsu);
    return reply({error:"A InfinitePay não gerou um link válido para o teste. Nenhuma venda foi criada."},502,origin);
   }
   const {error:saveError}=await admin.from("infinitepay_test_payments").update({
    checkout_url:link,invoice_slug:clean(result?.invoice_slug,200),updated_at:new Date().toISOString()
   }).eq("order_nsu",orderNsu);
   if(saveError) throw saveError;
   return reply({ok:true,test:true,amount:"R$ 1,00",order_nsu:orderNsu,checkout_url:link,expires_at:expiresAt.toISOString(),
    warning:"Pagamento isolado: não cria pedido comercial, não altera estoque e não libera entrega."},200,origin);
  }
  if(body?.action==="status"){
   const id=clean(body?.order_nsu,40);
   const {data,error}=await admin.from("infinitepay_test_payments")
    .select("order_nsu,amount_cents,status,checkout_url,invoice_slug,transaction_nsu,paid_amount_cents,capture_method,provider_verified,webhook_received_at,paid_at,created_at")
    .eq("order_nsu",id).eq("created_by",user.id).maybeSingle();
   if(error) throw error;
   if(!data) return reply({error:"Teste não encontrado."},404,origin);
   return reply({ok:true,test:true,payment:data,fulfillment_released:false},200,origin);
  }
  return reply({error:"Ação inválida."},400,origin);
 } catch(error) {
  const message=error instanceof Error?error.message:"Falha ao processar teste.";
  const status=/login|sessão/i.test(message)?401:/restrito/i.test(message)?403:500;
  return reply({error:message},status,origin);
 }
});
