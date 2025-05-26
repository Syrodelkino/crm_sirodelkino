import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(CrmApp());
}

class CrmApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Сыродельная CRM',
      theme: ThemeData(
        primarySwatch: Colors.green,
        useMaterial3: true,
      ),
      home: OrdersPage(),
    );
  }
}

class OrdersPage extends StatefulWidget {
  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  late Future<List<Map<String, dynamic>>> futureOrders;

  @override
  void initState() {
    super.initState();
    futureOrders = fetchOrders();
  }

  String formatDate(String isoString) {
    try {
      final date = DateTime.parse(isoString).toLocal();
      return '${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return isoString;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Заявки')),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: futureOrders,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('❌ Ошибка: ${snapshot.error}'));
          }

          final orders = snapshot.data!;
          if (orders.isEmpty) {
            return const Center(child: Text('Заявок пока нет.'));
          }

          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                futureOrders = fetchOrders();
              });
            },
            child: ListView.builder(
              itemCount: orders.length,
              itemBuilder: (context, index) {
                final order = orders[index];
                return ListTile(
                  title: Text('${order['restaurant']} — ${order['cheese']}'),
                  subtitle: Text('Кол-во: ${order['quantity']} • Статус: ${order['status']}'),
                  trailing: Text(
                    DateTime.tryParse(order['timestamp']) != null
                        ? formatDate(order['timestamp'])
                        : order['timestamp'].toString(),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

Future<List<Map<String, dynamic>>> fetchOrders({String? month}) async {
  final url = Uri.parse(
    'https://script.google.com/macros/s/AKfycbx4c7byO9tu5wxnwCKePRJHyBnvc7JSuiFgQUhvXqvZel3Xge-xF2hB2nRY1XmVJX4A-g/exec' +
        (month != null ? '?month=$month' : ''),
  );

  try {
    final response = await http.get(url);
    debugPrint('📥 Ответ сервера: ${response.body}');

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.cast<Map<String, dynamic>>();
    } else {
      throw Exception('Ошибка сервера: ${response.statusCode}');
    }
  } catch (e) {
    debugPrint('❌ Ошибка fetchOrders: $e');
    return [];
  }
}
