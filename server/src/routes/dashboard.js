import { Router } from 'express';
import Issue from '../models/Issue.js';
const router=Router();
router.get('/summary',async(req,res,next)=>{try{const scope=req.user.role==='student'?{createdBy:req.user._id}:req.user.role==='staff'?{assignedTo:req.user._id}:{};const [total,open,inProgress,resolved]=await Promise.all([Issue.countDocuments(scope),Issue.countDocuments({...scope,status:{$in:['open','assigned']}}),Issue.countDocuments({...scope,status:'in_progress'}),Issue.countDocuments({...scope,status:'resolved'})]);res.json({success:true,data:{summary:{total,open,inProgress,resolved}}});}catch(e){next(e);}});
export default router;
