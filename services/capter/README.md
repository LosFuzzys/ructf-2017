# Capter

* golang JSON-RPC сервер (capter)
* shared key-value (capterka)

## Легенда

### Общая

При освоении планет и терраформинге появилась необходимость засылать определенные химические элементы, образцы почвы, примеры ландшафта на различные участки планеты, чтобы смотреть, что и где приживется. Для чистоты эксперимента, рассылающий модуль выбирает несколько мест случайным образом, отправляет туда образцы, и впоследствии проверяет, удачный ли был выбор.
Если образцы успешно прижились, эксперимент продолжается пока планета не будет признана полностью готовой к жизни, в противном случае, место на некоторое время исключается из списка пригодных. Чем больше экспериментов прижилось, тем более приоритетным будет место для жизни в будущем.

Такой системой оказался  C.A.P.T.E.R - Cosmic Automatic Pattern Transmitter-Exchanger-Receiver

## Описание файлов

### C.A.P.T.E.R

Сервис

+ Cosmic - утилиты
+ Automatic - основная логика C.A.P.T.E.R
+ Pattern - создание образцов
+ Transmitter - рассылка образцов
+ Excahger - приложение
+ Receiver - получение образцов

### C.A.P.T.E.R.Сa

БД

C.A.P.T.E.R.Сa - C.A.P.T.E.R Candidate

Место-кандидат для отправки образцов.

Задепоить только бинарник.

## Уязвимости

В сервисе было запланировано две уязвиомсти, которые были частично связаны (использование одной сильно упрощает использование другой). В частности:

### LIST

>Простая уязвимость.
> Требует смекалки и знания REST (в частности http OPTIONS), либо реверса Go - так или иначе, поняв, как работает LIST можно таскать флаги пачками. Для защиты требуется запатчить бинарник или, что проще, спрятать Capterca за реверс-прокси и запретить все, кроме GET,POST,LEN (LEN нужно чекеру)

Capterca помимо GET и POST имеет также методы LEN, LIST и OPTIONS.
OPTIONS собственно рассказывает какие методы есть. 
LEN говорит количество записей в базе
LIST - принимает параметр $key, и выводит список всех ключей в базе, начинающихся с $key.

Таким образом, зная, что ключи в базе строятся по принципу timestamp-short_id, можно выбрать все ключи, начинающиеся с таймстемпа раунда, после чего пройтись по командам и сделать get для данных id.

Даже если бы LIST не было - всё равно есть возможность выводить все ключи для своей базы, после чего запрашивать у сервиса флаги по id. (Так можно получить только те флаги, которые прилетели вам, но это все равно больше, чем ничего)

Таким образом, чтобы закрыться от этой архитектурной уязвимости - стоит на сервисе сохранять в Capterca не с тем же id, а с неким внутренним, имея соответствие в локальной базе сервиса. Таким образом, даже зная все ключи из Capterca не будет возможности получить флаг - только зашифрованное значение.

(При условии, что не хочется патчить бинарник и фильтровать LIST запросы)

### Crypto

>Криптография избыточна

Для шифрования используется пароль из 16 символов, но на деле из-за за сдвигов используется меньше. Более того, при внимательном рассмотрении оказывается, что вместо 16 символьного пароля, для расшифровки нужны лишь два uint32 числа.
Более того, эти числа можно легко вычислить, зная открытую часть. (см. sploits/capter/crypto/sploit.go)

Для защиты необходимо усилить криптографию, например увеличив количество раундов на блок, либо поменяв алгоритм, заменив XOR на что-то иное(хотя б на сложение)

Для атаки, научившись взламывать крипто, можно вытаскивать все криптофлаги из своей C.A.P.T.E.R.Сa (а при использовании LIST - из любой с запросом GET /?id=ID), и расшифровывать их.