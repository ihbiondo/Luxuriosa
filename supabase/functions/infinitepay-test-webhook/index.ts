import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_KEY=Deno.env.get("INFINITEPAY_API_KEY")||"";
const HANDLE=Deno.env.get("INFINITEPAY_HANDLE")||"";
const admin=createClient(URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
function reply(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});}
function clean(v:unknown,max=200){return typeof v==="string"?v.trim().slice(0,max):"";}
function uuid(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);}

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST") return reply({error:"Método não permitido."},405);
 try{
  const body=await req.json();
  const orderNsu=clean(body?.order_nsu,50);
  const transactionNsu=clean(body?.transaction_nsu,160);
  const slug=clean(body?.invoice_slug||body?.slug,200);
  if(!uuid(orderNsu)||!transactionNsu||!slug) return reply({ok:true,ignored:true});
  const {data:session,error}=await admin.from("infinitepay_test_payments")
   .select("order_nsu,amount_cents,status").eq("order_nsu",orderNsu).maybeSingle();
  if(error) throw error;
  if(!session) return reply({ok:true,ignored:true});
  if(session.status==="paid") return reply({ok:true,duplicate:true,test:true,fulfillment_released:false});
  if(!API_KEY||!HANDLE) throw new Error("Credenciais InfinitePay indisponíveis.");
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
  let check:Response;
  try{check=await fetch("https://api.checkout.infinitepay.io/payment_check",{
   method:"POST",headers:{"content-type":"application/json","X-Api-Key":API_KEY},
   body:JSON.stringify({handle:HANDLE,order_nsu:orderNsu,transaction_nsu:transactionNsu,slug}),signal:controller.signal
  });}finally{clearTimeout(timer);}
  const verified=await check.json().catch(()=>({}));
  if(!check.ok||verified?.success!==true||verified?.paid!==true) return reply({error:"Pagamento ainda não confirmado pela InfinitePay."},503);
  const amount=Number(verified.amount),paidAmount=Number(verified.paid_amount);
  const method=verified.capture_method==="pix"||verified.capture_method==="credit_card"?verified.capture_method:null;
  const receipt=clean(body?.receipt_url,1000);
  let safeReceipt:string|null=null;try{const u=new URL(receipt);if(u.protocol==="https:")safeReceipt=u.toString();}catch{}
  const validAmount=Number.isSafeInteger(amount)&&amount===100&&Number.isSafeInteger(paidAmount)&&paidAmount>=100;
  const {error:updateError}=await admin.from("infinitepay_test_payments").update({
   status:validAmount?"paid":"review_required",provider_verified:true,transaction_nsu:transactionNsu,
   invoice_slug:slug,paid_amount_cents:Number.isSafeInteger(paidAmount)?paidAmount:null,
   capture_method:method,receipt_url:safeReceipt,webhook_received_at:new Date().toISOString(),
   paid_at:validAmount?new Date().toISOString():null,updated_at:new Date().toISOString()
  }).eq("order_nsu",orderNsu).eq("status","pending");
  if(updateError) throw updateError;
  return reply({ok:true,test:true,paid:validAmount,review_required:!validAmount,fulfillment_released:false});
 }catch(error){
  console.error("infinitepay-test-webhook:",error);
  return reply({error:"Falha ao verificar pagamento de teste."},503);
 }
});
