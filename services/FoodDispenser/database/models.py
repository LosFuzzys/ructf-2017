import peewee
from datetime import datetime
from peewee import *


def init_models(db):
    class AbstractTable(peewee.Model):
        class Meta:
            database = db

    class User(AbstractTable):
        username = CharField(unique=True, max_length=32)
        password_hash = CharField(max_length=64)
        registration_date = DateTimeField(default=datetime.now)
        is_food_service = BooleanField(default=False)
        user_groups = TextField(default='["standard"]')
        user_meta = TextField(default="")

    class TicketStorage(AbstractTable):
        ticket_provider = CharField(max_length=32)
        ticket_code = CharField(max_length=32)
        ticket_content = CharField(max_length=32)
        ticket_target_group = CharField(max_length=32)

    class Ratings(AbstractTable):
        food_service_id = IntegerField()
        client_id = IntegerField()
        stars_amount = IntegerField()
        comment_content = TextField(default="")

    class Group(AbstractTable):
        group_name = CharField(max_length=32, unique=True)
        group_creator_id = IntegerField()
        group_invites_list = TextField()

    def init_db():
        if not User.table_exists():
            User.create_table()
        if not TicketStorage.table_exists():
            TicketStorage.create_table()
        if not Ratings.table_exists():
            Ratings.create_table()
        if not Group.table_exists():
            Group.create_table()

    return User, TicketStorage, Ratings, Group, init_db
