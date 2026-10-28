package com.jotafy.app;
import android.app.*;
import android.content.*;
import android.os.*;
import android.graphics.Bitmap;
import android.service.notification.StatusBarNotification;
import android.view.*;
import android.widget.TextView;
import java.io.*;
import java.util.*;
import org.json.JSONObject;

/** Local emulator fixtures only. Never creates server financial events. */
public class SmokeRunner extends Instrumentation {
 Bundle args;
 @Override public void onCreate(Bundle parameters){args=parameters;super.onCreate(parameters);start();}
 void require(boolean condition,String message){if(!condition)throw new AssertionError(message);}
 @Override public void onStart(){
  Bundle result=new Bundle();
  try {
   Context c=getTargetContext();
   String credentialPath=args.getString("credentials");
   if(credentialPath!=null) {
    ParcelFileDescriptor p=getUiAutomation().executeShellCommand("cat "+credentialPath);
    String value;try(InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(p)){value=new String(in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).trim();}
    Store.save(c,"https://jotafy.joaolucasqtb.workers.dev",value);
    require(Store.secret(c).equals(value),"Existing secure storage must round-trip");
    value=null;
   }
   NotificationManager manager=c.getSystemService(NotificationManager.class);
   manager.cancelAll();
   Store.prefs(c).edit().putBoolean("push_enabled",true).putBoolean("pref_showValue",false).putBoolean("pref_pix_generated",false).commit();
   long now=System.currentTimeMillis();
   Map<String,String> fixture=new HashMap<>();fixture.put("eventId",String.valueOf(now*10+1));fixture.put("kind","approved");fixture.put("method","pix");fixture.put("amountCents","1000");fixture.put("createdAt",String.valueOf(now));
   Notices.receive(c,fixture);Thread.sleep(300);require(manager.getActiveNotifications().length==1,"First event must create one notification");
   Notices.receive(c,fixture);Thread.sleep(300);require(manager.getActiveNotifications().length==1,"Redelivery must not duplicate");
   fixture.put("eventId",String.valueOf(now*10+2));Notices.receive(c,fixture);Thread.sleep(300);require(manager.getActiveNotifications().length==2,"New event must preserve previous notification");
   for(StatusBarNotification n:manager.getActiveNotifications()){
    String title=n.getNotification().extras.getCharSequence("android.title","").toString();require(!title.contains("R$"),"Value preference must hide amount");
    require(n.getNotification().publicVersion!=null,"Lockscreen requires generic public version");
    require(n.getNotification().getSmallIcon()!=null,"Own small icon required");
   }
   fixture.put("eventId",String.valueOf(now*10+3));fixture.put("kind","pix_generated");Notices.receive(c,fixture);Thread.sleep(200);require(manager.getActiveNotifications().length==2,"Disabled category must not notify");
   fixture.put("eventId",String.valueOf(now*10+4));fixture.put("kind","approved");fixture.put("createdAt",String.valueOf(now-3600001));Notices.receive(c,fixture);require(manager.getActiveNotifications().length==2,"Expired event must not notify");
   require(!Notices.channel(c,"approved").equals(Notices.channel(c,"pix_generated")),"Pix and approvals need separate channels");
   manager.cancelAll();Store.prefs(c).edit().putBoolean("push_enabled",false).putBoolean("pref_showValue",true).putBoolean("pref_pix_generated",true).commit();
   Intent intent=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
   MainActivity activity=(MainActivity)startActivitySync(intent);
   long deadline=System.currentTimeMillis()+45000;
   while(activity.dashboard==null&&System.currentTimeMillis()<deadline){Thread.sleep(500);waitForIdleSync();}
   require(activity.dashboard!=null,"Real authenticated dashboard must load");
   require(activity.dashboard.has("daily"),"API must provide real daily aggregates");
   Thread.sleep(500);waitForIdleSync();
   String size=args.getString("size","phone");
   capture(c,"dashboard-"+size+".png");
   runOnMainSync(()->{require(activity.shell.getWidth()>0,"Layout must measure");require(activity.body.getWidth()<=activity.shell.getWidth(),"Body must fit safe screen width");activity.page=1;activity.render();});
   waitForIdleSync();capture(c,"history-"+size+".png");
   runOnMainSync(()->{activity.page=2;activity.render();});
   waitForIdleSync();capture(c,"settings-"+size+".png");
   runOnMainSync(()->{activity.page=0;activity.render();});
   waitForIdleSync();
   result.putString("stream","PASS: secure storage, real dashboard, notification deduplication, distinct event IDs, categories, privacy, expiry, channels, safe width and screenshots. Local notification fixtures only; no real FCM delivery tested.");
   finish(Activity.RESULT_OK,result);
  }catch(Throwable failure){result.putString("stream","FAIL: "+failure.getClass().getSimpleName()+": "+failure.getMessage());finish(Activity.RESULT_CANCELED,result);}
 }
 void capture(Context c,String name)throws Exception {
  Bitmap bitmap=getUiAutomation().takeScreenshot();require(bitmap!=null,"Screenshot must be available");
  File dir=new File(c.getExternalFilesDir(null),"screenshots");dir.mkdirs();
  try(FileOutputStream out=new FileOutputStream(new File(dir,name))){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}
  bitmap.recycle();
 }
}
