import { z } from 'zod';
import { moneySchema, paymentTypeSchema } from './finance';
export const idSchema=z.coerce.number().int().positive();
const name=z.string().trim().min(1).max(200);
const note=z.string().max(2000).nullable().optional();
export const normalizePhone=(v:string)=>{const d=v.replace(/\D/g,'');return d.length===9?'998'+d:d;};
export const uzDate=(v:Date|string=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
export function monthBounds(year:number,month:number,toMonth=month){return {startDate:new Date(Date.UTC(year,month-1,1,-5)),endDate:new Date(Date.UTC(year,toMonth,1,-5)-1)};}
export function parseClassTime(v:string){const m=v.trim().match(/^(\d{1,2}):(\d{2})(?:\s*[-–—]\s*(\d{1,2}):(\d{2}))?$/);if(!m)return null;const start=Number(m[1])*60+Number(m[2]),end=m[3]?Number(m[3])*60+Number(m[4]):start+90;if(Number(m[1])>23||Number(m[2])>59||(m[3]&&(Number(m[3])>23||Number(m[4])>59))||end<=start||end>1440)return null;return {start,end};}
export const studentInput=z.object({firstName:name,lastName:name,phone:z.string().max(30).default(''),parentPhone:z.string().max(30).default(''),status:z.enum(['active','paused','left']).default('active'),groupId:idSchema.optional()}).strict();
export const groupInput=z.object({name,teacherId:name,subjectId:z.preprocess(v=>v===''?null:v,idSchema.nullable().optional()),level:name.default('Beginner'),days:z.array(z.enum(['Du','Se','Chor','Pay','Ju','Juma','Sha','Yak','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'])).min(1),time:z.string().refine(v=>!!parseClassTime(v),'Vaqt HH:mm yoki HH:mm - HH:mm bo‘lsin'),room:z.string().max(200).nullable().optional(),maxStudents:z.coerce.number().int().min(1).max(500).default(15)}).strict();
export const attendanceInput=z.object({studentId:idSchema,groupId:idSchema,date:z.coerce.date(),status:z.enum(['present','absent','late']),notes:note}).strict();
export const gradeInput=z.object({studentId:idSchema,groupId:idSchema,date:z.coerce.date(),grade:z.coerce.number().int().min(1).max(5),topic:note,notes:note}).strict();
export const expenseInput=z.object({title:name,amount:moneySchema,category:z.enum(['rent','salary','supplies','utilities','marketing','other','staff_salary']),teacherId:z.string().nullable().optional(),staffId:z.string().nullable().optional(),notes:note,date:z.coerce.date().optional()}).strict();
export const cashInput=z.object({amount:moneySchema,paymentType:paymentTypeSchema,note}).strict();
export const subjectInput=z.object({name,description:note}).strict();
export const leadInput=z.object({firstName:name,lastName:name,phone:name,status:z.enum(['new','contacted','trial','converted','lost']),source:name,interest:name,notes:note}).strict();
