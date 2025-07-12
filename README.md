# プロミスベースのイベントリスナー

従来のPromiseでは、コールバックベースの`addEventListener()`をラップすることは**できません**。(できても `addEventListener()`と同じ挙動にならない)

しかし、`EventSignal.addEventListenerTo()`を使えば、プロミスベースのような構文でイベントリスナーを追加できます！( `addEventListener()`と同じ挙動になる)

例を以下に示します:
```
const element1 = document.querySelector('example1');
const element2 = document.querySelector('example2');

// element1 がクリックされたら element2 にイベントリスナーを追加
EventSignal.addEventListenerTo(element1, 'click')
  .receive(e => EventSignal.addEventListenerTo(element2, 'click'))
  .receive(e => console.log('success!: ', e));

// もし従来の addEventListener() を使うなら、こうなっていたでしょう
element1.addEventListener('click', e =>
  element2.addEventListener('click', e =>
    console.log('success!:', e)
  )
);
```

# リファレンス

まず最初に [Promiseのリファレンス(MDN)](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Promise)を読むと理解が早くなります。

## 基底クラス Signal 

### コンストラクター
- `new Signal()`: `element.addEventListener()` などをラップするために使う。これは引数を2つとる。
  - `raise`: シグナルを指定した値で送る。この関数は引数を1つ取り、何度でもシグナルを送信可能。
    - `raiseVal`: 送る値。 
  - `error`: シグナルを指定した値で失敗させる。この関数は引数を1つ取る。
    - `throwVal:` 失敗させる値。
___
### 静的プロパティ

- `Signal.NOT_RAISED`(定数): シグナルの状態を表す定数で、まだ1度もシグナルが送られていない状態。
- `Signal.RAISED`(定数): シグナルの状態を表す定数で、1回以上シグナルを送った状態。
- `Signal.FAILED`(定数): シグナルの状態を表す定数で、エラーが発生してる状態。
- `Signal.CLOSED`(定数): シグナルの状態を表す定数で、もう二度とシグナルが送られることはない状態。
___
### 静的メソッド

- `Signal.raise()`: 状態が `Signal.RAISED` のシグナルを返す。この関数は引数を1つとる。
  - `raiseVal` シグナルとして送る値を指定する。
- `Signal.throw()`: 状態が `Signal.FAILED` のシグナルを返す。この関数は引数を1つとる。
  - `throwVal` エラーとして送る値を指定する
- `Signal.withRaisers()`: 下記のオブジェクト。
  - `signal` 新しい `Signal`
  - `raiser`: `raise()`関数と同じ役割。
  - `thrower`: `error()`関数と同じ役割。
### インスタンスメソッド
- `Signal.prototype.receive()`: 送られてきたシグナルを処理する。この関数は引数を2つ取る。
  - `handlerOnRaised`: シグナルが送られてきたときに実行する関数。この関数は1つの引数 `data`を取ることができる。
  - `handlerOnFailed`: シグナルが失敗したときに実行する関数。この関数は1つの引数 `reason`を取ることができる。
- `Signal.prototype.catch()`: 失敗したシグナルを処理する。この関数は引数を1つ取る。
  - `handlerOnFailed`: シグナルが失敗したときに実行する関数。この関数は1つの引数 `reason`を取ることができる。
