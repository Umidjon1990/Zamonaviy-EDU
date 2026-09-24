import type { Express, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { storage } from './storage';
import { FinanceError } from './payment-service';
import { attendanceInput, expenseInput, gradeInput, groupInput, idSchema, leadInput, studentInput, subjectInput } from '../shared/domain';

// This guard covers common AND legacy teacher routes. UI permissions are not authorization.
export function registerAccessGuards(app:Express,auth:RequestHandler){
 const roots=['students','groups','attendance','grades','subjects','leads','teachers','teacher','teacher-salary','stats','finance','branding','settings','cash-receipts','staff','managers','tenant-sms'];
 for(const root of roots)app.use('/api/'+root,auth);
 app.use('/api',async(req:any,res,next)=>{
  const path=req.path,root=path.split('/')[1];if(!roots.includes(root))return next();
  try{
   const tenantId=req.session.tenantId,uid=req.session.userId,role=req.session.role,teacher=role==='teacher',write=!['GET','HEAD'].includes(req.method);
   const user=req.authUser||await storage.getUser(uid);
   const deny=()=>{throw new FinanceError('Bu amal uchun ruxsat yo‘q',403);};
   const permission=(p:string)=>{if(teacher&&!user?.permissions?.includes(p))deny();};
   if(!['markaz_admin','manager','teacher'].includes(role))deny();
   if(teacher&&['stats','finance','leads','staff','managers','settings'].includes(root))deny();
   if(teacher&&((root==='branding'&&write)||(root==='subjects'&&write)))deny();
   if(role==='manager'&&write&&root!=='cash-receipts')deny();
   const ownGroup=async(value:any)=>{const id=idSchema.parse(value);const g=await storage.getGroup(id,tenantId);if(!g||g.archivedAt)throw new FinanceError('Guruh topilmadi',404);if(teacher&&g.teacherId!==uid)deny();return g;};
   const ownStudent=async(value:any)=>{const id=idSchema.parse(value);const s=await storage.getStudent(id,tenantId);if(!s||s.archivedAt)throw new FinanceError('O‘quvchi topilmadi',404);if(teacher&&!(await storage.getStudentsByTeacher(uid,tenantId)).some(s=>s.id===id))deny();return s;};
   const gm=path.match(/^\/groups\/(\d+)/);if(gm)await ownGroup(gm[1]);
   const sm=path.match(/^\/(?:teacher\/)?students\/(\d+)/);if(sm)await ownStudent(sm[1]);
   if(teacher&&root==='students'){
    if(path==='/students/unassigned'||path.includes('/excel/')||path.endsWith('bulk-delete')||(req.method==='DELETE'&&!path.includes('/groups/')))deny();
    if(write)permission(req.method==='DELETE'?'remove_student':req.method==='POST'?'add_student':'edit_group');
   }
   if(teacher&&root==='groups'&&write){if(req.method==='DELETE'&&!path.includes('/students/'))deny();permission(path.includes('/students')?(req.method==='DELETE'?'remove_student':'add_student'):req.method==='POST'?'create_group':'edit_group');}
   if(path==='/teacher/move-student'){permission('move_student');await ownStudent(req.body.studentId);await ownGroup(req.body.fromGroupId);await ownGroup(req.body.toGroupId);}
   const membershipPath=path.match(/^\/students\/\d+\/groups\/(\d+)$/);if(membershipPath)await ownGroup(membershipPath[1]);
   if(path==='/students/bulk-add')await ownGroup(req.body.groupId);
   if(root==='cash-receipts'){
    const cm=path.match(/^\/cash-receipts\/(\d+)/);if(cm){const receipt=await storage.getCashReceipt(idSchema.parse(cm[1]),tenantId);if(!receipt)throw new FinanceError('Topilmadi',404);if(teacher&&receipt.submittedBy!==uid)deny();}
    if(teacher&&path.includes('/stats/'))deny();
   }
   if(!write){
    if(teacher&&root==='grades'&&!req.query.groupId)deny();
    if(teacher&&root==='attendance'&&path!=='/attendance')deny();
    if(['grades','attendance'].includes(root)&&req.query.groupId)await ownGroup(req.query.groupId);
    return next();
   }
   let schema:z.ZodTypeAny|undefined;
   const partial=req.method==='PATCH'||req.method==='PUT';
   if(/^\/(?:teacher\/)?students(?:\/\d+)?$/.test(path)&&req.method!=='DELETE')schema=partial?studentInput.omit({groupId:true}).partial():studentInput;
   if(/^\/groups(?:\/\d+)?$/.test(path)&&req.method!=='DELETE')schema=partial?groupInput.partial():groupInput;
   if(/^\/leads(?:\/\d+)?$/.test(path)&&req.method!=='DELETE')schema=partial?leadInput.partial():leadInput;
   if(/^\/subjects(?:\/\d+)?$/.test(path)&&req.method!=='DELETE')schema=partial?subjectInput.partial():subjectInput;
   if(root==='expenses')schema=partial?expenseInput.partial():expenseInput;
   if(root==='attendance'||root==='grades'){
    const m=path.match(/\/(\d+)$/);const old=m?await (root==='attendance'?storage.getAttendanceById(Number(m[1]),tenantId):storage.getGradeById(Number(m[1]),tenantId)):null;
    if(m&&!old)throw new FinanceError('Yozuv topilmadi',404);
    const d={...old,...req.body};await ownGroup(d.groupId);await ownStudent(d.studentId);
    if(!(await storage.getStudentGroups(Number(d.studentId),tenantId)).some(g=>g.groupId===Number(d.groupId)))throw new FinanceError('O‘quvchi guruhga tegishli emas');
    if(req.method!=='DELETE')schema=root==='attendance'?(partial?attendanceInput.pick({status:true,notes:true}).partial():attendanceInput):(partial?gradeInput.pick({grade:true,topic:true,notes:true}).partial():gradeInput);
   }
   if(schema)req.body=schema.parse(req.body);
   if(req.body.groupId)await ownGroup(req.body.groupId);
   if(root==='groups'&&!path.includes('/students')&&req.body.teacherId){const t=await storage.getTeacher(req.body.teacherId,tenantId);if(!t||t.archivedAt)throw new FinanceError('O‘qituvchi topilmadi',404);if(teacher&&t.id!==uid)deny();}
   if(req.body.subjectId&&!await storage.getSubject(req.body.subjectId,tenantId))throw new FinanceError('Fan topilmadi',404);
   if(root==='teachers'&&req.body.password&&String(req.body.password).length<10)throw new FinanceError('Parol kamida 10 belgidan iborat bo‘lsin');
   if(root==='teachers'&&req.body.salaryPercent!==undefined)req.body.salaryPercent=z.coerce.number().int().min(0).max(100).parse(req.body.salaryPercent);
   next();
  }catch(e){if(e instanceof ZodError)return res.status(400).json({error:'Noto‘g‘ri yoki ruxsat etilmagan maydon',details:e.issues});if(e instanceof FinanceError)return res.status(e.status).json({error:e.message});res.status(503).json({error:'Tekshiruv bajarilmadi'});}
 });
 // Expense ownership applies to every write, including partial updates.
 app.use('/api/expenses',auth,async(req:any,res,next)=>{try{if(['POST','PUT','PATCH'].includes(req.method)){req.body=(req.method==='POST'?expenseInput:expenseInput.partial()).parse(req.body);for(const [field,role] of [['teacherId','teacher'],['staffId','staff']])if(req.body[field]){const u=await storage.getUser(req.body[field]);if(!u||u.tenantId!==req.session.tenantId||u.role!==role||u.archivedAt)throw new Error('Xodim markazga tegishli emas');}}next();}catch{res.status(400).json({error:'Xarajat ma’lumotlari noto‘g‘ri'});}});
}
