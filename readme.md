# VRM1.0 Viewer
ローカルで実行可能なVRM　Viewerです。

一つのフォルダに必要なファイルをセットし読み込むことで動作します。

外部との通信は行いません。

---
# 概要

VRMモデルとVRMAを組み合わせた動作確認や、Expressionの動作確認に使用したり

置き物としての動作を想定しています。

用意していただくのは、VRMファイル1つ、VRMAファイルは0～複数個、1つのjsonファイルです。

背景色はjsonファイルで指定可能です。

カメラ位置はマウス操作で変更可能です。

---
# フォルダ構成

読み込ませるフォルダの構成

```
指定するフォルダ/
 ├ character.vrm
 ├ anime1.vrma
 ├ anime2.vrma
 ├ anime3.vrma
 └ config.json
```

---
# JSONファイルフォーマット

JSONファイルは、下記の様な構成にしてください。

```
[
  {
    "background": "#00b148"
  },
  {
    "vrma": "anime1.vrma",
    "exp": { "happy": 0.8 }
  },
  {
    "vrma": "anime2.vrma",
    "exp": { "angry": 1.0, "blink": 0.5 }
  },
  {
    "vrma": "anime3.vrma",
    "exp": {}
  },
  {
    "vrma": "",
    "exp": {}
  }
]
```
---
# 注意事項

VRMやVRMAファイルはライセンス周りが厳しいので、ご自身でご準備ください。

必要ファイルを一式読み込ませたタイミングで、拡張機能の方で

createVRMAnimationClip: VRMLookAtQuaternionProxy is not found. Creating a new one automatically. To suppress this warning, create a VRMLookAtQuaternionProxy manually

というエラーが出ます。three-vrmの方でもissueが上がっていますが、動作上問題のない無害な警告です。

モデル自体に問題がある場合、「Expressionが存在しない」「必須ボーンがない」等のエラーが出る場合がありますが、

本アプリに修正するための機能はありませんので、UnityやBlenderで修正してみてください。

本アプリの動作確認は、VRoidStudioで作成したモデルを「VRoid Project」様の配布しているアニメーション7種で動作確認しております。

---
# 免責事項

本アプリ利用に伴ういかなる損害についても作者は責任を負いません。

---
# セキュリティ関連

この拡張機能はデータを外部に送信しません。

また広告による収益、データ取得はありません。

アカウント登録は必要ありません。

この拡張機能は、ユーザーが明示的に選択したディレクトリからのみファイルを読み取ります。

---
# 技術関連

このプロジェクトでは、次のオープンソースライブラリを使用します。

* Three.js
* three-vrm
* three-vrm-animation

これらのライブラリは MIT ライセンスに基づいて配布されます。

---
# ライセンス（License）

MIT License

Copyright (c) 2026 Nitaro

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the Software without restriction.

See the LICENSE file for full details.

---
