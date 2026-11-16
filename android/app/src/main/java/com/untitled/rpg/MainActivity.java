package com.untitled.rpg;

import android.os.Bundle;
import android.os.Process;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 플레이 중에는 화면이 꺼지지 않게 한다.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    /**
     * 게임 종료(App.exitApp)는 화면만 닫아서, Capacitor가 WebView를 정리하지 않은 채 프로세스가 남는다.
     * 그러면 다시 켰을 때 이전 WebView의 게임과 메모리가 남아 버벅인다.
     * 화면이 완전히 닫힐 때는 WebView를 정리하고 프로세스까지 끝내, 다음 실행이 깨끗하게 시작되게 한다.
     */
    @Override
    public void onDestroy() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        boolean finishing = isFinishing();
        super.onDestroy();
        if (!finishing) return;
        if (webView != null) {
            webView.stopLoading();
            webView.removeAllViews();
            webView.destroy();
        }
        Process.killProcess(Process.myPid());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** 상태 표시줄과 내비게이션 바를 숨겨 전체 화면으로 쓴다. 가장자리를 쓸면 잠깐 나타난다. */
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
