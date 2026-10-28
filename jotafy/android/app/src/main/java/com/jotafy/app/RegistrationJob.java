package com.jotafy.app;
import android.app.job.*;
import java.util.concurrent.*;
public class RegistrationJob extends JobService {
 final ExecutorService io=Executors.newSingleThreadExecutor();
 @Override public boolean onStartJob(JobParameters parameters){
  io.execute(()->{boolean retry=false;try{PushRegistrar.perform(this);}catch(Exception e){retry=Store.prefs(this).getBoolean("push_enabled",false);PushRegistrar.status(this,"Registro pendente. Nova tentativa quando houver conexão.");}jobFinished(parameters,retry);});return true;
 }
 @Override public boolean onStopJob(JobParameters parameters){return Store.prefs(this).getBoolean("push_enabled",false);}
 @Override public void onDestroy(){io.shutdownNow();super.onDestroy();}
}
