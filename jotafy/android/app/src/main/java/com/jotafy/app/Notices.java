package com.jotafy.app;
import android.app.*;
import android.content.*;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import java.util.*;
import android.database.sqlite.SQLiteDatabase;

final class Notices {
 static final String[] KINDS={"approved","pix_generated","rejected","refunded","charged_back","cancelled"};
 static String category(String kind){return kind.equals("approved")?"approved":kind.equals("pix_generated")?"pix":"other";}
 static String channel(Context c,String kind){
  boolean sound=Store.prefs(c).getBoolean("pref_sound",true),vibration=Store.prefs(c).getBoolean("pref_vibration",true);
  String cat=category(kind),id="jotafy2_"+cat+"_"+(sound?"sound":"quiet")+"_"+(vibration?"vibrate":"still");
  NotificationChannel channel=new NotificationChannel(id,cat.equals("approved")?"Vendas aprovadas":cat.equals("pix")?"Pix aguardando pagamento":"Outros eventos",NotificationManager.IMPORTANCE_DEFAULT);
  channel.setDescription("Som e vibração finais são controlados pelas configurações do Android.");
  channel.enableVibration(vibration);channel.setVibrationPattern(new long[]{0,80,60,80});channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
  int soundId=cat.equals("pix")?R.raw.pix:R.raw.sale;
  Uri soundUri=Uri.parse("android.resource://"+c.getPackageName()+"/raw/"+(cat.equals("pix")?"pix":"sale"));
  channel.setSound(sound?soundUri:null,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
  c.getSystemService(NotificationManager.class).createNotificationChannel(channel);return id;
 }
 static void migrate(Context c){
  if(Store.prefs(c).getBoolean("migrated_v2",false))return;
  NotificationManager m=c.getSystemService(NotificationManager.class);m.cancel(1);m.deleteNotificationChannel("monitor");m.deleteNotificationChannel("sales");
  Store.prefs(c).edit().putBoolean("migrated_v2",true).remove("cursor").commit();
 }
 static boolean seen(Context c,String event){
  SQLiteDatabase db=c.openOrCreateDatabase("jotafy-notices.db",0,null);
  try{
   db.execSQL("CREATE TABLE IF NOT EXISTS seen (event TEXT PRIMARY KEY, at INTEGER NOT NULL)");
   db.execSQL("DELETE FROM seen WHERE at<?",new Object[]{System.currentTimeMillis()-86400000L});
   android.content.ContentValues values=new android.content.ContentValues();values.put("event",Store.prefs(c).getString("url","")+"#"+event);values.put("at",System.currentTimeMillis());
   return db.insertWithOnConflict("seen",null,values,SQLiteDatabase.CONFLICT_IGNORE)==-1;
  } finally {db.close();}
 }
 static void receive(Context c,Map<String,String> data){
  if(!Store.prefs(c).getBoolean("push_enabled",false))return;
  try {
   String event=data.get("eventId"),kind=data.get("kind");
   if(event==null||!event.matches("[1-9][0-9]{0,15}")||!Arrays.asList(KINDS).contains(kind))return;
   long created=Long.parseLong(data.get("createdAt")),now=System.currentTimeMillis();
   if(created<now-3600000L || created>now+300000L || !Store.preferences(c).optBoolean(kind))return;
   long amount=Long.parseLong(data.get("amountCents"));
   if(amount<0||amount>1000000000L || !c.getSystemService(NotificationManager.class).areNotificationsEnabled())return;
   if(seen(c,event))return;
   post(c,event,kind,data.getOrDefault("method","unknown"),amount,false);
  }catch(Exception ignored){}
 }
 static void demo(Context c,String kind){
  if(!c.getSystemService(NotificationManager.class).areNotificationsEnabled())return;
  post(c,"demo-"+UUID.randomUUID(),kind,"pix",1000,true);
 }
 static void post(Context c,String event,String kind,String method,long amount,boolean demo){
  String title=(demo?"Demonstração · ":"")+Store.label(kind);
  if(Store.prefs(c).getBoolean("pref_showValue",true))title+=" • "+Store.money(amount);
  String body=kind.equals("pix_generated")?"Um cliente gerou um Pix. Aguardando pagamento.":kind.equals("approved")?(method.equals("unknown")?"Pagamento confirmado.":"Pagamento confirmado via "+Store.label(method)+"."):kind.equals("refunded")?"Um pagamento foi reembolsado.":kind.equals("rejected")?"O pagamento não foi aprovado.":"Atualização de pagamento disponível.";
  if(demo)body="Demonstração local. Nenhuma venda ou Pix foi criado.";
  Intent intent=new Intent(c,MainActivity.class).setData(Uri.parse("jotafy://event/"+event)).putExtra("event_id",event).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
  PendingIntent tap=PendingIntent.getActivity(c,0,intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  Notification publicVersion=new Notification.Builder(c,channel(c,kind)).setSmallIcon(R.drawable.ic_notification).setContentTitle("JotaFy").setContentText("Uma atualização está disponível. Abra o aplicativo.").setContentIntent(tap).build();
  Notification n=new Notification.Builder(c,channel(c,kind)).setSmallIcon(R.drawable.ic_notification).setColor(0xff276454).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicVersion).setCategory(Notification.CATEGORY_EVENT).build();
  try{c.getSystemService(NotificationManager.class).notify("jotafy-"+event,0,n);}catch(SecurityException ignored){}
 }
}
