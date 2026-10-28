package com.jotafy.app;
import android.app.job.*;
import android.content.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.android.gms.tasks.Tasks;
import java.util.concurrent.*;
import org.json.*;

final class PushRegistrar {
 static final int REGISTRATION_JOB=202;
 static boolean available(Context c) {
  if(!BuildConfig.FIREBASE_CONFIGURED || BuildConfig.APPLICATION_ID.endsWith(".preview"))return false;
  try {if(FirebaseApp.getApps(c).isEmpty())return FirebaseApp.initializeApp(c)!=null;return true;}catch(Exception e){return false;}
 }
 static void status(Context c,String message){Store.prefs(c).edit().putString("push_status",message).apply();}
 static void sync(Context context) {
  Context c=context.getApplicationContext();
  if(!Store.prefs(c).getBoolean("push_enabled",false))return;
  if(!available(c)){status(c,"Push aguardando configuração Firebase");return;}
  FirebaseMessaging.getInstance().setAutoInitEnabled(true);
  JobScheduler scheduler=c.getSystemService(JobScheduler.class);
  if(scheduler.getPendingJob(REGISTRATION_JOB)==null) {
   int result=scheduler.schedule(new JobInfo.Builder(REGISTRATION_JOB,new ComponentName(c,RegistrationJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPersisted(true).setBackoffCriteria(30000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());
   if(result!=JobScheduler.RESULT_SUCCESS)status(c,"Registro pendente. Reabra o app para tentar novamente.");
  }
 }
 static void register(Context context,String ignoredToken){sync(context);}
 static synchronized void perform(Context c)throws Exception {
  if(!Store.prefs(c).getBoolean("push_enabled",false)||!available(c))return;
  String token=Tasks.await(FirebaseMessaging.getInstance().getToken(),20,TimeUnit.SECONDS);
  JSONObject body=new JSONObject().put("installationId",Store.installation(c)).put("fcmToken",token).put("preferences",Store.preferences(c));
  Store.request(c,"POST","/devices",body);status(c,"Dispositivo conectado ao push");
 }
 static synchronized void disconnect(Context c)throws Exception {
  if(!Store.prefs(c).getString("url","").isEmpty())Store.request(c,"DELETE","/devices/"+Store.installation(c),null);
  Store.prefs(c).edit().putBoolean("push_enabled",false).putString("push_status","Notificações desconectadas").commit();
  c.getSystemService(JobScheduler.class).cancel(REGISTRATION_JOB);
  if(available(c)){FirebaseMessaging.getInstance().setAutoInitEnabled(false);FirebaseMessaging.getInstance().deleteToken();}
 }
}
