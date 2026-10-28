package com.jotafy.app;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.net.Uri;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

public class MainActivity extends Activity {
 static final int INK=0xff102D2C,GREEN=0xff276454,LIME=0xffD1F27A,BG=0xffF3F6F1,MUTED=0xff52645F,LINE=0xffE3EADF;
 LinearLayout shell,body,nav;ScrollView scroll;TextView status;int days=1,page=0,generation=0;
 JSONObject dashboard;String csv="",error="";boolean loading=false;long updated=0;
 final ExecutorService io=Executors.newSingleThreadExecutor();
 int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
 @Override public void onCreate(Bundle state){super.onCreate(state);if(state!=null){days=state.getInt("days",1);page=state.getInt("page",0);}Notices.migrate(this);build();refresh();PushRegistrar.sync(this);handleIntent(getIntent());}
 @Override protected void onSaveInstanceState(Bundle state){state.putInt("days",days);state.putInt("page",page);super.onSaveInstanceState(state);}
 @Override public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handleIntent(intent);}
 void handleIntent(Intent intent){String event=intent.getStringExtra("event_id");if(event==null)return;intent.removeExtra("event_id");if(event.startsWith("demo-")){message("Demonstração local","Esta notificação é uma demonstração. Nenhuma venda, Pix ou conversão foi criada.");return;}if(event.matches("[1-9][0-9]{0,15}"))detail(event);}
 GradientDrawable shape(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
 TextView text(String value,int size,int color,boolean bold){
  TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setFontFeatureSettings("tnum");t.setTypeface(Typeface.create(bold?"sans-serif-medium":"sans-serif",Typeface.NORMAL));t.setLineSpacing(dp(2),1);t.setIncludeFontPadding(false);return t;
 }
 LinearLayout column(){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);return l;}
 LinearLayout row(){LinearLayout l=new LinearLayout(this);l.setGravity(Gravity.CENTER_VERTICAL);return l;}
 void space(LinearLayout parent,int height){View v=new View(this);parent.addView(v,new LinearLayout.LayoutParams(1,dp(height)));}
 void add(LinearLayout parent,View child){parent.addView(child,new LinearLayout.LayoutParams(-1,-2));}
 TextView action(String label,boolean primary,Runnable onClick){
  TextView b=text(label,14,primary?0xffffffff:INK,true);b.setGravity(Gravity.CENTER);b.setPadding(dp(16),dp(14),dp(16),dp(14));b.setMinHeight(dp(48));b.setBackground(shape(primary?GREEN:0xffE7EDDF,16));b.setClickable(true);b.setFocusable(true);b.setContentDescription(label);b.setOnClickListener(v->onClick.run());return b;
 }
 LinearLayout card(LinearLayout parent){LinearLayout c=column();c.setPadding(dp(20),dp(20),dp(20),dp(20));c.setBackground(shape(0xffffffff,24));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.bottomMargin=dp(16);parent.addView(c,lp);return c;}
 void title(LinearLayout parent,String title,String subtitle){add(parent,text(title,19,INK,true));space(parent,6);if(!subtitle.isEmpty()){add(parent,text(subtitle,13,MUTED,false));space(parent,12);}}
 void build(){
  shell=column();shell.setBackgroundColor(BG);setContentView(shell);
  shell.setOnApplyWindowInsetsListener((v,insets)->{
   if(Build.VERSION.SDK_INT>=30){android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());shell.setPadding(safe.left,safe.top,safe.right,safe.bottom);}
   else shell.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
   return insets;
  });if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);shell.requestApplyInsets();
  LinearLayout header=row();header.setPadding(dp(24),dp(16),dp(24),dp(12));
  ImageView mark=new ImageView(this);mark.setImageResource(R.drawable.ic_brand);mark.setContentDescription("JotaFy");header.addView(mark,new LinearLayout.LayoutParams(dp(42),dp(42)));
  LinearLayout names=column();names.setPadding(dp(12),0,0,0);add(names,text(BuildConfig.APPLICATION_ID.endsWith(".preview")?"JotaFy Prévia":"JotaFy",24,INK,true));space(names,3);add(names,text("Seu negócio, em movimento",11,MUTED,false));header.addView(names,new LinearLayout.LayoutParams(0,-2,1));
  TextView sync=action("↻",false,()->refresh());sync.setTextSize(24);sync.setContentDescription("Atualizar vendas");header.addView(sync,new LinearLayout.LayoutParams(dp(48),dp(48)));add(shell,header);
  scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setClipToPadding(false);
  FrameLayout frame=new FrameLayout(this);body=new MaxColumn(this);body.setPadding(dp(20),dp(8),dp(20),dp(18));FrameLayout.LayoutParams center=new FrameLayout.LayoutParams(-1,-2,Gravity.TOP|Gravity.CENTER_HORIZONTAL);frame.addView(body,center);scroll.addView(frame);shell.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
  nav=row();nav.setPadding(dp(16),dp(10),dp(16),dp(12));nav.setBackgroundColor(0xffffffff);String[] tabs={"Resumo","Atividade","Ajustes"};for(int i=0;i<tabs.length;i++){final int tab=i;TextView button=action(tabs[i],false,()->{page=tab;render();scroll.smoothScrollTo(0,0);});LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,-2,1);lp.setMargins(dp(3),0,dp(3),0);nav.addView(button,lp);}add(shell,nav);render();
 }
 class MaxColumn extends LinearLayout {MaxColumn(Context c){super(c);setOrientation(LinearLayout.VERTICAL);}@Override protected void onMeasure(int w,int h){super.onMeasure(MeasureSpec.makeMeasureSpec(Math.min(MeasureSpec.getSize(w),dp(740)),MeasureSpec.EXACTLY),h);}}
 void render(){
  if(body==null)return;body.removeAllViews();for(int i=0;i<nav.getChildCount();i++){TextView t=(TextView)nav.getChildAt(i);t.setBackground(shape(i==page?INK:0xffffffff,16));t.setTextColor(i==page?LIME:MUTED);}
  if(page==2){settings();return;}
  status=text(loading?"Atualizando suas vendas…":!error.isEmpty()?error:updated>0?"Atualizado às "+Store.time(updated,false)+" · Brasília":"Conecte seu monitor para começar",12,!error.isEmpty()?0xff925A30:MUTED,false);status.setPadding(dp(4),dp(2),dp(4),dp(14));add(body,status);
  if(dashboard==null){LinearLayout empty=card(body);title(empty,"Tudo pronto para acompanhar","Conecte o monitor para ver suas vendas reais, com segurança.");add(empty,action("Conectar meu monitor",true,()->connection()));space(empty,12);add(empty,text("Sem cobranças, sem dados pessoais de compradores.",12,MUTED,false));return;}
  if(page==1){history(body,dashboard.optJSONArray("recent"),true);return;}
  LinearLayout selectors=row();String[] labels={"Hoje","7 dias","30 dias"};int[] values={1,7,30};for(int i=0;i<3;i++){final int period=values[i];TextView chip=action(labels[i],false,()->{if(days!=period){days=period;refresh();}});chip.setBackground(shape(days==period?INK:0xffE5EBDF,16));chip.setTextColor(days==period?LIME:INK);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);p.setMargins(dp(3),0,dp(3),dp(16));selectors.addView(chip,p);}add(body,selectors);
  int reportedDays=dashboard.optInt("days",days); JSONObject summary=dashboard.optJSONObject("summary");if(summary==null)summary=new JSONObject();long revenue=summary.optLong("revenue"),sales=summary.optLong("sales");
  LinearLayout hero=card(body);hero.setBackground(shape(INK,28));add(hero,text("RECEITA BRUTA",12,0xffC9D7C9,true));space(hero,12);add(hero,text(Store.money(revenue),38,0xffffffff,true));space(hero,8);add(hero,text(reportedDays==1?"Hoje · horário de Brasília":"Últimos "+reportedDays+" dias de calendário · Brasília",12,0xffD1DEC9,false));space(hero,24);
  LinearLayout metrics=row();LinearLayout a=column(),b=column();add(a,text(String.valueOf(sales),26,LIME,true));space(a,5);add(a,text("Vendas aprovadas",12,0xffDFE9DC,false));add(b,text(sales==0?"—":Store.money(revenue/sales),23,LIME,true));space(b,5);add(b,text("Ticket médio",12,0xffDFE9DC,false));metrics.addView(a,new LinearLayout.LayoutParams(0,-2,1));metrics.addView(b,new LinearLayout.LayoutParams(0,-2,1));add(hero,metrics);space(hero,20);add(hero,text("Reembolsos e contestações fora dos totais.",11,0xffC9D7C9,false));
  LinearLayout daily=card(body);title(daily,"Seu ritmo de vendas","Receita aprovada por dia · valores brutos");
  JSONArray series=dashboard.optJSONArray("daily");if(series==null){add(daily,text("O gráfico ficará disponível após a atualização da API. Nenhum histórico foi estimado.",13,MUTED,false));}else {add(daily,new Charts(this,series,false));if(sales>0){space(daily,8);for(int i=0;i<series.length();i++){JSONObject d=series.optJSONObject(i);if(d.optLong("sales")>0)add(daily,text(Charts.shortDate(d.optString("date"))+"   "+d.optLong("sales")+" venda(s) · "+Store.money(d.optLong("revenue")),12,MUTED,false));}}}
  LinearLayout methods=card(body);title(methods,"Como seus clientes pagam","Distribuição das vendas aprovadas");JSONArray distribution=dashboard.optJSONArray("methods");if(distribution==null)distribution=new JSONArray();
  if(distribution.length()==0)add(methods,text("Nenhuma venda aprovada neste período. As formas reais de pagamento aparecerão aqui.",14,MUTED,false));
  else {add(methods,new Charts(this,distribution,true));for(int i=0;i<distribution.length();i++){JSONObject m=distribution.optJSONObject(i);LinearLayout line=row();TextView dot=text("●",18,Charts.COLORS[i%Charts.COLORS.length],true);line.addView(dot);TextView label=text("  "+Store.label(m.optString("method")),14,INK,false);line.addView(label,new LinearLayout.LayoutParams(0,-2,1));TextView value=text(m.optLong("sales")+" venda(s)"+(m.has("revenue")?"\n"+Store.money(m.optLong("revenue")):""),13,INK,true);value.setGravity(Gravity.END);line.addView(value);space(methods,10);add(methods,line);}}
  history(body,dashboard.optJSONArray("recent"),false);
  add(body,action("Exportar resumo CSV",false,()->export()));space(body,14);add(body,text("Leitura protegida · valores brutos, sem taxas ou saldo disponível.",11,MUTED,false));
 }
 void history(LinearLayout parent,JSONArray events,boolean full){
  LinearLayout list=card(parent);title(list,"Movimentos recentes","Pix gerado não representa pagamento aprovado.");
  if(events==null||events.length()==0){add(list,text("Nenhum evento registrado. Novos eventos reais aparecerão aqui; o histórico anterior não é reconstruído.",14,MUTED,false));return;}
  int count=full?events.length():Math.min(5,events.length());String previous="";
  for(int i=0;i<count;i++){
   JSONObject event=events.optJSONObject(i);String date=Store.time(event.optLong("created_at"),true).substring(0,5);
   if(!date.equals(previous)){space(list,12);add(list,text(date+" · Brasília",12,MUTED,true));space(list,10);previous=date;}
   LinearLayout line=row();String kind=event.optString("kind");TextView icon=text(kind.equals("approved")?"✓":kind.equals("pix_generated")?"◇":kind.equals("refunded")?"↩":kind.equals("rejected")?"×":"↔",22,kind.equals("rejected")?0xff9D4A3D:GREEN,true);icon.setGravity(Gravity.CENTER);icon.setBackground(shape(kind.equals("approved")?0xffE8F5CF:0xffF1F3EC,13));line.addView(icon,new LinearLayout.LayoutParams(dp(42),dp(46)));
   LinearLayout info=column();info.setPadding(dp(12),dp(6),dp(8),dp(6));add(info,text(Store.label(kind),14,INK,true));space(info,4);add(info,text(Store.label(event.optString("method"))+" · "+Store.time(event.optLong("created_at"),false),12,MUTED,false));line.addView(info,new LinearLayout.LayoutParams(0,-2,1));
   TextView value=text(Store.money(event.optLong("amount_cents")),14,INK,true);line.addView(value);line.setMinimumHeight(dp(64));line.setFocusable(true);line.setClickable(true);line.setContentDescription(Store.label(kind)+" "+Store.money(event.optLong("amount_cents"))+"; abrir detalhe");String id=event.optString("seq");line.setOnClickListener(v->{if(id.matches("[1-9][0-9]*"))detail(id);else message("Detalhe indisponível","Atualize a API para consultar o detalhe protegido.");});add(list,line);
  }
  if(!full&&events.length()>5){space(list,12);add(list,action("Ver toda a atividade",false,()->{page=1;render();scroll.smoothScrollTo(0,0);}));}
 }
 void refresh(){
  final int request=++generation,period=days;loading=true;error="";render();
  io.execute(()->{try{JSONObject result=Store.load(this,period,false);runOnUiThread(()->{if(request!=generation||isFinishing())return;dashboard=result;updated=System.currentTimeMillis();loading=false;error="";render();});}catch(Exception e){runOnUiThread(()->{if(request!=generation||isFinishing())return;loading=false;error=Store.prefs(this).getString("url","").isEmpty()?"Conecte seu monitor para começar.":"Não foi possível atualizar. "+e.getMessage()+" Toque em ↻ para tentar novamente.";render();});}});
 }
 void settings(){
  LinearLayout intro=card(body);title(intro,"Do seu jeito","Sua conexão e suas preferências, em um só lugar.");add(intro,text("JotaFy "+BuildConfig.VERSION_NAME,12,MUTED,false));space(intro,16);add(intro,action("Conexão e chave de acesso",true,()->connection()));space(intro,10);add(intro,action("Dispositivos conectados",false,()->devices()));space(intro,10);add(intro,action("Desconectar notificações deste aparelho",false,()->disconnect()));
  LinearLayout push=card(body);title(push,"Notificações individuais","Sem serviço permanente de conexão.");
  String pushState=!PushRegistrar.available(this)?"Push aguardando configuração Firebase":Store.prefs(this).getString("push_status","Ative para registrar este aparelho.");add(push,text(pushState,13,MUTED,false));space(push,14);add(push,action("Ativar notificações push",true,()->activate()));
  LinearLayout prefs=card(body);title(prefs,"O que você quer acompanhar?","Pix pendente e venda paga têm notificações distintas.");
  toggle(prefs,"Vendas aprovadas","approved",true);toggle(prefs,"Pix gerado · aguardando pagamento","pix_generated",true);toggle(prefs,"Reembolsos","refunded",true);toggle(prefs,"Pagamentos recusados","rejected",false);toggle(prefs,"Contestações","charged_back",true);toggle(prefs,"Cancelamentos","cancelled",false);
  LinearLayout privacy=card(body);title(privacy,"Som e privacidade","A tela bloqueada mostra apenas um aviso genérico.");toggle(privacy,"Som das notificações","sound",true);toggle(privacy,"Vibração","vibration",true);toggle(privacy,"Mostrar valor no título ao desbloquear","showValue",true);space(privacy,14);add(privacy,action("Testar venda · demonstração local",false,()->demo("approved")));space(privacy,10);add(privacy,action("Testar Pix · demonstração local",false,()->demo("pix_generated")));space(privacy,12);add(privacy,text("Testes apenas neste aparelho. Nenhuma venda, Pix ou evento Meta será criado.",12,MUTED,false));space(privacy,14);add(privacy,action("Abrir configurações do Android",false,()->startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()))));space(privacy,12);add(privacy,text("O Android controla canais já criados, som, vibração e Não Perturbe. Push depende de rede e das restrições do aparelho; não há garantia de entrega imediata.",12,MUTED,false));
 }
 void toggle(LinearLayout parent,String label,String key,boolean initial){
  boolean on=Store.prefs(this).getBoolean("pref_"+key,initial);
  TextView option=action((on?"✓  ":"○  ")+label,false,()->{Store.prefs(this).edit().putBoolean("pref_"+key,!on).apply();PushRegistrar.sync(this);render();});option.setGravity(Gravity.CENTER_VERTICAL);option.setTextSize(13);option.setContentDescription(label+(on?", ativado":", desativado"));add(parent,option);space(parent,8);
 }
 void activate(){
  if(!PushRegistrar.available(this)){message("Configuração pendente","O monitor continua funcionando. Push precisa do projeto Firebase e da configuração Android e do servidor. Esta versão não usa o serviço permanente antigo.");return;}
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},7);return;}
  Store.prefs(this).edit().putBoolean("push_enabled",true).apply();PushRegistrar.sync(this);render();message("Registro iniciado","O status do registro aparecerá em Ajustes. Entrega de push depende de rede, permissão e configuração Firebase.");
 }
 @Override public void onRequestPermissionsResult(int r,String[] p,int[] g){super.onRequestPermissionsResult(r,p,g);if(r==7&&g.length>0&&g[0]==0)activate();else if(r==8&&g.length>0&&g[0]==0)message("Permissão concedida","Toque novamente no teste de demonstração.");}
 void demo(String kind){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},8);return;}Notices.demo(this,kind);message("Demonstração local","Uma notificação de demonstração foi solicitada ao Android. Canais silenciados, modo silencioso ou Não Perturbe podem impedir o som.");}
 void connection(){
  LinearLayout box=column();box.setPadding(dp(24),dp(16),dp(24),dp(8));EditText url=field("URL HTTPS do monitor",Store.prefs(this).getString("url","https://jotafy.joaolucasqtb.workers.dev"));EditText token=field("Chave de acesso · 64 caracteres","");token.setInputType(129);add(box,url);space(box,12);add(box,token);space(box,12);add(box,text("Sua chave fica protegida pelo Android Keystore. Deixe em branco para preservar a chave atual na mesma URL.",12,MUTED,false));
  AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Conectar monitor").setView(box).setNegativeButton("Cancelar",null).setPositiveButton("Salvar",null).create();dialog.setOnShowListener(d->dialog.getButton(-1).setOnClickListener(v->{
   final String target=url.getText().toString().trim(),provided=token.getText().toString().trim();dialog.getButton(-1).setEnabled(false);
   io.execute(()->{try{
    String value=provided.isEmpty()&&target.replaceAll("/$","").equals(Store.prefs(this).getString("url",""))?Store.secret(this):provided;
    if(Store.prefs(this).getBoolean("push_enabled",false))PushRegistrar.disconnect(this);
    Store.save(this,target,value);
    runOnUiThread(()->{dashboard=null;updated=0;dialog.dismiss();refresh();});
   }catch(Exception e){runOnUiThread(()->{dialog.getButton(-1).setEnabled(true);Toast.makeText(this,e.getMessage(),Toast.LENGTH_LONG).show();});}});
  }));dialog.show();
 }
 EditText field(String hint,String value){EditText e=new EditText(this);e.setText(value);e.setHint(hint);e.setTextSize(14);e.setTextColor(INK);e.setSingleLine(true);e.setSelectAllOnFocus(true);e.setPadding(dp(16),dp(14),dp(16),dp(14));e.setBackground(shape(BG,14));e.setMinimumHeight(dp(52));return e;}
 void disconnect(){io.execute(()->{try{PushRegistrar.disconnect(this);runOnUiThread(()->{render();message("Dispositivo removido","Este aparelho não receberá novos eventos push. Sua conexão de leitura foi preservada.");});}catch(Exception e){runOnUiThread(()->message("Não foi possível desconectar","A conexão foi preservada para você tentar novamente. "+e.getMessage()));}});}
 void devices(){
  io.execute(()->{try{JSONObject response=Store.request(this,"GET","/devices",null);JSONArray devices=response.getJSONArray("devices");runOnUiThread(()->{if(devices.length()==0){message("Dispositivos","Nenhum dispositivo registrado para push.");return;}String[] labels=new String[devices.length()];for(int i=0;i<labels.length;i++){JSONObject d=devices.optJSONObject(i);String id=d.optString("id");labels[i]=(id.equals(Store.installation(this))?"Este aparelho":"Dispositivo "+id.substring(0,8))+" · "+Store.time(d.optLong("updated_at"),true);}new AlertDialog.Builder(this).setTitle("Remover dispositivo").setItems(labels,(dialog,index)->{String id=devices.optJSONObject(index).optString("id");new AlertDialog.Builder(this).setTitle("Desconectar dispositivo?").setMessage("Ele deixará de receber notificações de vendas.").setNegativeButton("Cancelar",null).setPositiveButton("Desconectar",(x,y)->io.execute(()->{try{Store.request(this,"DELETE","/devices/"+id,null);if(id.equals(Store.installation(this)))Store.prefs(this).edit().putBoolean("push_enabled",false).apply();runOnUiThread(()->{render();message("Dispositivo removido","Cadastro e envios pendentes removidos.");});}catch(Exception e){runOnUiThread(()->message("Não foi possível remover",e.getMessage()));}})).show();}).setNegativeButton("Fechar",null).show();});}catch(Exception e){runOnUiThread(()->message("Dispositivos",e.getMessage()));}});
 }
 void detail(String id){io.execute(()->{try{JSONObject event=Store.request(this,"GET","/events/"+id,null).getJSONObject("event");runOnUiThread(()->message(Store.label(event.optString("kind")),Store.money(event.optLong("amount_cents"))+"\n"+Store.label(event.optString("method"))+"\n"+Store.time(event.optLong("created_at"),true)+" · Brasília\n\n"+(event.optString("kind").equals("pix_generated")?"Este Pix aguarda pagamento. Não é uma venda aprovada.":"Evento confirmado pelo backend.\nIdentificador: "+event.optLong("seq"))));}catch(Exception e){runOnUiThread(()->message("Detalhe protegido",e.getMessage()));}});}
 void export(){
  if(dashboard==null){message("Sem relatório","Atualize as vendas primeiro.");return;}
  try{JSONObject s=dashboard.getJSONObject("summary");StringBuilder data=new StringBuilder("Período (dias);Vendas aprovadas;Receita bruta BRL\n").append(dashboard.optInt("days",days)).append(';').append(s.getLong("sales")).append(';').append(String.format(Locale.US,"%.2f",s.getLong("revenue")/100.0)).append("\n\nForma;Vendas\n");JSONArray methods=dashboard.getJSONArray("methods");for(int i=0;i<methods.length();i++){JSONObject m=methods.getJSONObject(i);data.append(Store.label(m.getString("method"))).append(';').append(m.getLong("sales")).append('\n');}JSONArray daily=dashboard.optJSONArray("daily");if(daily!=null){data.append("\nData (Brasília);Vendas;Receita bruta BRL\n");for(int i=0;i<daily.length();i++){JSONObject d=daily.getJSONObject(i);data.append(d.getString("date")).append(';').append(d.getLong("sales")).append(';').append(String.format(Locale.US,"%.2f",d.getLong("revenue")/100.0)).append('\n');}}csv=data.toString();Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("text/csv").putExtra(Intent.EXTRA_TITLE,"JotaFy-"+days+"-dias.csv").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(intent,8);}catch(Exception e){message("Exportação","Atualize o relatório e tente novamente.");}
 }
 @Override protected void onActivityResult(int r,int result,Intent data){super.onActivityResult(r,result,data);if(r==8&&result==RESULT_OK&&data!=null){try(java.io.OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(("\uFEFF"+csv).getBytes("UTF-8"));message("Relatório salvo","CSV exportado com o resumo e os dados diários disponíveis.");}catch(Exception e){message("Exportação","Não foi possível salvar o arquivo.");}}}
 void message(String title,String body){if(!isFinishing())new AlertDialog.Builder(this).setTitle(title).setMessage(body).setPositiveButton("Entendi",null).show();}
 @Override public void onDestroy(){generation++;io.shutdownNow();super.onDestroy();}
}
