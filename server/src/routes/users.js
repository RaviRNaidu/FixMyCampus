import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import { allow } from '../middleware/auth.js';
const router=Router();
router.get('/staff',allow('admin'),async(req,res,next)=>{try{const users=await User.find({role:'staff',isActive:true}).select('name email role department').sort({name:1});res.json({success:true,data:{users}});}catch(e){next(e);}});
router.post('/staff',allow('admin'),async(req,res,next)=>{try{const body=z.object({name:z.string().trim().min(2).max(80),email:z.string().trim().email().max(254),password:z.string().min(8).max(100),department:z.string().trim().max(100).optional()}).strict().parse(req.body);const email=body.email.toLowerCase();if(await User.exists({email}))return res.status(409).json({success:false,error:{code:'CONFLICT',message:'An account with this email already exists.'}});const passwordHash=await bcrypt.hash(body.password,12);const user=await User.create({name:body.name,email,passwordHash,department:body.department,role:'staff'});res.status(201).json({success:true,data:{user:{id:user._id,name:user.name,email:user.email,role:user.role,department:user.department}}});}catch(e){next(e);}});
export default router;
