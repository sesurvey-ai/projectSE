# Use Supabase with Flutter

Learn how to create a Supabase project, add some sample data to your database, and query the data from a Flutter app.

---

## 1. Create a Supabase project

Go to [database.new](https://database.new) and create a new Supabase project.

Alternatively, you can create a project using the Management API:

```bash
# First, get your access token from https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN="your-access-token"

# List your organizations to get the organization ID
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  https://api.supabase.com/v1/organizations

# Create a new project (replace <org-id> with your organization ID)
curl -X POST https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "<org-id>",
    "name": "My Project",
    "region": "us-east-1",
    "db_pass": "<your-secure-password>"
  }'
```

When your project is up and running, go to the Table Editor, create a new table and insert some data.

Alternatively, you can run the following snippet in your project's SQL Editor. This will create an `instruments` table with some sample data.

```sql
-- Create the table
create table instruments (
  id bigint primary key generated always as identity,
  name text not null
);

-- Insert some sample data into the table
insert into instruments (name)
values
  ('violin'),
  ('viola'),
  ('cello');

alter table instruments enable row level security;
```

Make the data in your table publicly readable by adding an RLS policy:

```sql
create policy "public can read instruments"
on public.instruments
for select to anon
using (true);
```

---

## 2. Create a Flutter app

Create a Flutter app using the `flutter create` command. You can skip this step if you already have a working app.

```bash
flutter create my_app
```

---

## 3. Install the Supabase client library

The fastest way to get started is to use the [`supabase_flutter`](https://pub.dev/packages/supabase_flutter) client library which provides a convenient interface for working with Supabase from a Flutter app.

Open the `pubspec.yaml` file inside your Flutter app and add `supabase_flutter` as a dependency.

```yaml
supabase_flutter: ^2.0.0
```

---

## 4. Initialize the Supabase client

Open `lib/main.dart` and edit the main function to initialize Supabase using your project URL and public API (anon) key:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
  );
  runApp(MyApp());
}
```

> **Note on API keys:** Supabase is transitioning to new key types. The new publishable key has the form `sb_publishable_xxx` and will replace the older `anon` key. In most cases, you can get the correct key from the Project's **Connect** dialog. See the [API keys docs](https://supabase.com/docs/guides/api/api-keys) for full details.

---

## 5. Query data from the app

Use a `FutureBuilder` to fetch the data when the home page loads and display the query result in a `ListView`.

Replace the default `MyApp` and `MyHomePage` classes with the following code:

```dart
class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'Instruments',
      home: HomePage(),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _future = Supabase.instance.client
      .from('instruments')
      .select();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: FutureBuilder(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final instruments = snapshot.data!;
          return ListView.builder(
            itemCount: instruments.length,
            itemBuilder: ((context, index) {
              final instrument = instruments[index];
              return ListTile(
                title: Text(instrument['name']),
              );
            }),
          );
        },
      ),
    );
  }
}
```

---

## 6. Start the app

Run your app on a platform of your choosing! By default an app should launch in your web browser.

> `supabase_flutter` is compatible with web, iOS, Android, macOS, and Windows apps. Running on macOS requires additional configuration to [set the entitlements](https://docs.flutter.dev/development/platform-integration/macos/building#setting-up-entitlements).

```bash
flutter run
```

---

## Setup deep links

Many sign-in methods require deep links to redirect the user back to your app after authentication. Read more about setting deep links up for all platforms (including web) in the [Flutter Mobile Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-flutter#setup-deep-links).

---

## Going to production

### Android

In production, your Android app needs explicit permission to use the internet connection on the user's device, which is required to communicate with Supabase APIs.

Add the following line to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Required to fetch data from the internet. -->
    <uses-permission android:name="android.permission.INTERNET" />
    <!-- ... -->
</manifest>
```
