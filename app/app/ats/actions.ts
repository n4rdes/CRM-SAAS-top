"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";

const text=(f:FormData,k:string)=>String(f.get(k)??"").trim();
const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function fail(message:string,job?:string):never{redirect(`/app/ats${job?`?job=${job}&`:"?"}error=${encodeURIComponent(message)}`)}
function done(message:string,job?:string):never{revalidatePath("/app","layout");redirect(`/app/ats${job?`?job=${job}&`:"?"}success=${encodeURIComponent(message)}`)}
function slugify(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)}

export async function updateCareerPage(formData:FormData){
  const {supabase,tenant,membership}=await requireWorkspace(); if(!["owner","admin","hr","recruiter"].includes(membership.role)) fail("Sem permissão para configurar a página de carreiras.");
  const color=text(formData,"career_primary_color");
  const {error}=await supabase.from("tenants").update({career_page_enabled:formData.get("career_page_enabled")==="on",career_page_title:text(formData,"career_page_title")||null,career_page_description:text(formData,"career_page_description")||null,career_primary_color:/^#[0-9a-f]{6}$/i.test(color)?color:"#3156d8",career_logo_url:text(formData,"career_logo_url")||null}).eq("id",tenant.id);
  if(error) fail("Não foi possível salvar a página de carreiras."); done("Página de carreiras atualizada.");
}

export async function updateJobPublication(formData:FormData){
  const jobId=text(formData,"job_id"); if(!isUuid(jobId)) fail("Vaga inválida.");
  const {supabase,tenant,membership}=await requireWorkspace(); if(!["owner","admin","hr","recruiter","manager"].includes(membership.role)) fail("Sem permissão.",jobId);
  const title=text(formData,"title"); const published=formData.get("published")==="on"; const slug=slugify(text(formData,"public_slug")||title);
  const min=Math.round(Number(text(formData,"salary_min"))*100)||null; const max=Math.round(Number(text(formData,"salary_max"))*100)||null;
  const {error}=await supabase.from("jobs").update({public_slug:slug||jobId.slice(0,8),published_at:published?new Date().toISOString():null,employment_type:text(formData,"employment_type")||"full_time",workplace_type:text(formData,"workplace_type")||"onsite",city:text(formData,"city")||null,state:text(formData,"state")||null,salary_min_cents:min,salary_max_cents:max,salary_visible:formData.get("salary_visible")==="on",application_form_config:{phone_required:formData.get("phone_required")==="on",resume_required:false,consent_required:true}}).eq("id",jobId).eq("tenant_id",tenant.id);
  if(error) fail("Não foi possível publicar a vaga. Use outro endereço público.",jobId); done(published?"Vaga publicada na página de carreiras.":"Vaga removida da página pública.",jobId);
}

export async function addScreeningQuestion(formData:FormData){
  const jobId=text(formData,"job_id"); const question=text(formData,"question"); const type=text(formData,"question_type"); if(!isUuid(jobId)||question.length<3) fail("Informe a pergunta.",jobId);
  const {supabase,tenant}=await requireWorkspace(); const options=text(formData,"options").split(",").map(v=>v.trim()).filter(Boolean); const expected=text(formData,"expected_answer");
  const expectedAnswer=type==="boolean"?(expected==="true"):expected||null;
  const {error}=await supabase.from("job_screening_questions").insert({tenant_id:tenant.id,job_id:jobId,question,question_type:["text","long_text","boolean","single_select","number"].includes(type)?type:"text",options,required:formData.get("required")==="on",knockout:formData.get("knockout")==="on",expected_answer:expectedAnswer});
  if(error) fail("Não foi possível criar a pergunta.",jobId); done("Pergunta adicionada ao formulário.",jobId);
}

export async function deleteScreeningQuestion(formData:FormData){const id=text(formData,"id"),jobId=text(formData,"job_id");const {supabase,tenant}=await requireWorkspace();await supabase.from("job_screening_questions").delete().eq("tenant_id",tenant.id).eq("id",id);done("Pergunta removida.",jobId)}

export async function createInterviewKit(formData:FormData){
  const jobId=text(formData,"job_id"),name=text(formData,"name"); if(!isUuid(jobId)||name.length<2) fail("Informe o nome do kit.",jobId); const {supabase,tenant,user}=await requireWorkspace();
  const {data,error}=await supabase.from("interview_kits").insert({tenant_id:tenant.id,job_id:jobId,name,instructions:text(formData,"instructions")||null,created_by:user.id}).select("id").single(); if(error||!data) fail("Não foi possível criar o kit.",jobId);
  const criteria=text(formData,"criteria").split("\n").map(v=>v.trim()).filter(Boolean); if(criteria.length) await supabase.from("interview_criteria").insert(criteria.map((name,index)=>({tenant_id:tenant.id,kit_id:data.id,name,sort_order:(index+1)*10})));
  done("Kit de entrevista criado.",jobId);
}

export async function createInterviewSlot(formData:FormData){
  const jobId=text(formData,"job_id"),start=text(formData,"starts_at"),end=text(formData,"ends_at"); if(!isUuid(jobId)||!start||!end) fail("Informe início e fim do horário.",jobId); const startDate=new Date(start),endDate=new Date(end); if(Number.isNaN(startDate.getTime())||Number.isNaN(endDate.getTime())||endDate<=startDate||startDate<=new Date()) fail("Use um horário futuro e com término após o início.",jobId); const {supabase,tenant,user}=await requireWorkspace();
  const {error}=await supabase.from("interview_slots").insert({tenant_id:tenant.id,job_id:jobId,starts_at:startDate.toISOString(),ends_at:endDate.toISOString(),timezone:"America/Sao_Paulo",meeting_provider:text(formData,"meeting_provider")||"manual",meeting_url:text(formData,"meeting_url").slice(0,2000)||null,created_by:user.id}); if(error) fail("Não foi possível criar o horário.",jobId); done("Horário disponibilizado para autoagendamento.",jobId);
}

export async function createJobOffer(formData:FormData){
  const jobId=text(formData,"job_id"),applicationId=text(formData,"application_id"); if(!isUuid(jobId)||!isUuid(applicationId)) fail("Selecione uma candidatura.",jobId); const {supabase,tenant,user,membership}=await requireWorkspace(); if(!["owner","admin","hr","recruiter","manager"].includes(membership.role)) fail("Sem permissão para enviar propostas.",jobId);
  const {data:application}=await supabase.from("applications").select("id,candidate_id,job_id").eq("id",applicationId).eq("tenant_id",tenant.id).eq("job_id",jobId).maybeSingle(); if(!application) fail("A candidatura não pertence a esta vaga.",jobId);
  const body=text(formData,"body").slice(0,20000); if(body.length<10) fail("Escreva a mensagem da proposta.",jobId); const salary=Math.round(Number(text(formData,"salary"))*100)||null; const expiresRaw=text(formData,"expires_at"); const expiresAt=expiresRaw?new Date(expiresRaw):null; if(expiresAt&&Number.isNaN(expiresAt.getTime())) fail("A validade da proposta é inválida.",jobId);
  const {error}=await supabase.from("job_offers").insert({tenant_id:tenant.id,application_id:applicationId,candidate_id:application.candidate_id,title:text(formData,"title").slice(0,180)||"Proposta de contratação",body,salary_cents:salary,benefits:text(formData,"benefits").slice(0,10000)||null,start_date:text(formData,"start_date")||null,expires_at:expiresAt?.toISOString()??null,status:"sent",sent_at:new Date().toISOString(),created_by:user.id});
  if(error) fail("Não foi possível enviar a proposta.",jobId); await supabase.from("applications").update({stage:"offer"}).eq("id",applicationId).eq("tenant_id",tenant.id); done("Proposta criada e marcada como enviada.",jobId);
}
