import unittest
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Food, Meal, MealItem, User, WeeklyPlan
from app.routers.meal_items import move_meal_item
from app.schemas import MealItemMove


class MealItemMoveTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        self.db = sessionmaker(bind=engine)()

        user = User(
            email="move@example.com",
            password="test",
            nombre="Move Test",
            peso=70,
            altura=175,
            objetivo="mantener",
        )
        self.db.add(user)
        self.db.flush()

        self.plan = WeeklyPlan(
            user_id=user.id,
            nombre="Plan de prueba",
            semana_inicio=date(2099, 12, 28),
        )
        self.food = Food(
            nombre="Alimento de prueba",
            calorias=100,
            proteinas=10,
            carbos=10,
            grasas=2,
            fuente="test",
            user_id=user.id,
        )
        self.db.add_all([self.plan, self.food])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def create_meal(self, day, hour):
        meal = Meal(
            weekly_plan_id=self.plan.id,
            dia=day,
            tipo_comida="desayuno",
            hora=hour,
        )
        self.db.add(meal)
        self.db.commit()
        return meal

    def create_item(self, meal):
        item = MealItem(
            meal_id=meal.id,
            food_id=self.food.id,
            cantidad=1,
            notas="test",
        )
        self.db.add(item)
        self.db.commit()
        return item

    def test_moves_item_to_existing_meal_and_keeps_non_empty_source(self):
        source = self.create_meal("lunes", "09:00")
        target = self.create_meal("martes", "10:00")
        moved_item = self.create_item(source)
        remaining_item = self.create_item(source)

        result = move_meal_item(
            moved_item.id,
            MealItemMove(
                weekly_plan_id=self.plan.id,
                dia="martes",
                tipo_comida="desayuno",
                hora="10:00",
            ),
            self.db,
        )

        self.assertEqual(result["meal"].id, target.id)
        self.assertFalse(result["source_meal_deleted"])
        self.assertEqual(self.db.get(MealItem, moved_item.id).meal_id, target.id)
        self.assertEqual(self.db.get(MealItem, remaining_item.id).meal_id, source.id)
        self.assertIsNotNone(self.db.get(Meal, source.id))

    def test_creates_target_meal_and_removes_empty_source(self):
        source = self.create_meal("lunes", "09:00")
        moved_item = self.create_item(source)

        result = move_meal_item(
            moved_item.id,
            MealItemMove(
                weekly_plan_id=self.plan.id,
                dia="miercoles",
                tipo_comida="almuerzo",
                hora="12:00",
            ),
            self.db,
        )

        self.assertTrue(result["source_meal_deleted"])
        self.assertIsNone(self.db.get(Meal, source.id))
        self.assertEqual(self.db.get(MealItem, moved_item.id).meal_id, result["meal"].id)
        self.assertEqual(result["meal"].dia, "miercoles")
        self.assertEqual(result["meal"].hora, "12:00")


if __name__ == "__main__":
    unittest.main()
