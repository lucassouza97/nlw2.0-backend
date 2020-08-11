import { Request, Response } from 'express'
import db from '../database/connection'
import convertHourToMinutes from '../utils/convertHourToMinutes'

interface ScheduleItem {
  week_day: number
  from: string
  to: string
}

export default class classesController {
  async index(req: Request, res: Response) {
    const filters = req.query

    if (!filters.week_day || !filters.subject || !filters.time) {
      return res.status(400).json({
        error: 'Faltando parâmetros',
      })
    }
    const timeInMinuts = convertHourToMinutes(filters.time as string)
    const classes = await db('classes')
      .whereExists(function () {
        this.select('class_schedule.*')
          .from('class_schedule')
          .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
          .whereRaw('`class_schedule`.`week_day` = ??', [
            Number(filters.week_day as string),
          ])
          .whereRaw('`class_schedule`.`from` <= ??', [timeInMinuts])
          .whereRaw('`class_schedule`.`to` > ??', [timeInMinuts])
      })
      .where('classes.subject', '=', filters.subject as string)
      .join('users', 'classes.user_id', '=', 'users.id')
      .select(['classes.*', 'users.*'])
    return res.json({ classes })
  }

  async create(req: Request, res: Response) {
    const { name, avatar, whatsapp, bio, subject, cost, schedule } = req.body

    const trx = await db.transaction()

    try {
      const insertUsersIds = await trx('users').insert({
        name,
        avatar,
        whatsapp,
        bio,
      })

      const user_id = insertUsersIds[0]

      const insertClassIds = await trx('classes').insert({
        subject,
        cost,
        user_id,
      })

      const class_id = insertClassIds[0]

      const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
        return {
          class_id,
          week_day: scheduleItem.week_day,
          from: convertHourToMinutes(scheduleItem.from),
          to: convertHourToMinutes(scheduleItem.to),
        }
      })

      await trx('class_schedule').insert(classSchedule)

      await trx.commit()

      return res.status(201).send()
    } catch (error) {
      await trx.rollback()
      return res
        .status(400)
        .json({ error: 'Unexpected error while creating new class' })
      console.log(error)
    }
  }
}
